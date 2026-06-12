// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PlayerRegistry} from "./PlayerRegistry.sol";
import {ISomniaPlatform, IJsonApiAgent, ILlmInferenceAgent} from "./interfaces/ISomniaAgents.sol";

contract FantasyMatchRoom {
    uint256 public constant LINEUP_SIZE = 5;
    int256 public constant GOAL_POINTS = 5;
    int256 public constant ASSIST_POINTS = 3;
    int256 public constant CLEAN_SHEET_POINTS = 4;
    int256 public constant YELLOW_CARD_POINTS = -1;
    int256 public constant RED_CARD_POINTS = -3;
    int256 public constant MINUTES_60_PLUS_POINTS = 1;
    int256 public constant CAPTAIN_MULTIPLIER = 2;

    uint256 constant JSON_API_AGENT_ID = 13174292974160097713;
    uint256 constant LLM_INFERENCE_AGENT_ID = 12847293847561029384;
    uint256 constant JSON_FETCH_COST = 0.03 ether;
    uint256 constant LLM_INFERENCE_COST = 0.07 ether;

    struct PlayerStat {
        uint256 playerId;
        uint8 goals;
        uint8 assists;
        uint8 yellowCards;
        uint8 redCards;
        bool cleanSheet;
        uint16 minutesPlayed;
    }

    address public immutable creator;
    PlayerRegistry public immutable registry;
    bytes32 public immutable matchId;
    uint256 public immutable entryFee;
    uint256 public immutable maxParticipants;
    uint256 public immutable lineupDeadline;
    address public immutable somniaPlatform;

    bool public locked;
    bool public settled;
    bool public payoutComplete;

    uint256 public prizePool;
    address public winner;
    int256 public highestScore;
    bytes32 public latestStatsHash;
    string public latestReceipt;
    string public statsApiUrl;

    address[] public participants;
    mapping(address => bool) public joined;
    mapping(address => bool) public lineupSubmitted;
    mapping(address => uint256[]) private _lineups;
    mapping(address => uint256) public captainOf;
    mapping(address => int256) public scores;

    uint256 private _statsRequestId;
    uint256 private _receiptRequestId;

    event JoinedRoom(address indexed participant, uint256 entryFee);
    event LineupSubmitted(address indexed participant, uint256 captainId);
    event RoomLocked(uint256 atTimestamp);
    event SettlementRequested(address indexed caller);
    event MatchSettled(address indexed winner, int256 winningScore, bytes32 statsHash);
    event PrizeClaimed(address indexed winner, uint256 amount);
    event AgentStatsRequested(uint256 indexed requestId);
    event AgentReceiptRequested(uint256 indexed requestId);
    event AgentSettlementFailed(string reason);

    modifier onlyCreator() {
        require(msg.sender == creator, "Only creator");
        _;
    }

    constructor(
        address creator_,
        address registry_,
        bytes32 matchId_,
        uint256 entryFee_,
        uint256 maxParticipants_,
        uint256 lineupDeadline_,
        address somniaPlatform_
    ) {
        require(creator_ != address(0), "Invalid creator");
        require(registry_ != address(0), "Invalid registry");
        require(entryFee_ > 0, "Entry fee must be > 0");
        require(maxParticipants_ >= 2, "Max participants must be >= 2");
        require(lineupDeadline_ > block.timestamp, "Deadline must be in future");

        creator = creator_;
        registry = PlayerRegistry(registry_);
        matchId = matchId_;
        entryFee = entryFee_;
        maxParticipants = maxParticipants_;
        lineupDeadline = lineupDeadline_;
        somniaPlatform = somniaPlatform_;
    }

    function joinRoom() external payable {
        require(!locked, "Room is locked");
        require(!settled, "Room is settled");
        require(block.timestamp < lineupDeadline, "Deadline passed");
        require(!joined[msg.sender], "Already joined");
        require(participants.length < maxParticipants, "Room is full");
        require(msg.value == entryFee, "Wrong entry fee");

        joined[msg.sender] = true;
        participants.push(msg.sender);
        prizePool += msg.value;

        emit JoinedRoom(msg.sender, msg.value);
    }

    function submitLineup(uint256[] calldata playerIds, uint256 captainId) external {
        require(joined[msg.sender], "Join room first");
        require(!locked, "Room is locked");
        require(!settled, "Room is settled");
        require(block.timestamp < lineupDeadline, "Deadline passed");

        _validateLineup(playerIds, captainId);

        _lineups[msg.sender] = playerIds;
        captainOf[msg.sender] = captainId;
        lineupSubmitted[msg.sender] = true;

        emit LineupSubmitted(msg.sender, captainId);
    }

    function lockRoom() external {
        require(!locked, "Already locked");
        require(!settled, "Room is settled");
        require(block.timestamp >= lineupDeadline || msg.sender == creator, "Cannot lock yet");

        locked = true;
        emit RoomLocked(block.timestamp);
    }

    function setStatsApiUrl(string calldata url) external onlyCreator {
        statsApiUrl = url;
    }

    function requestSettlement() external payable {
        require(locked, "Room not locked");
        require(!settled, "Already settled");

        emit SettlementRequested(msg.sender);

        if (somniaPlatform != address(0) && bytes(statsApiUrl).length > 0) {
            _requestAgentSettlement();
        }
    }

    function _requestAgentSettlement() internal {
        require(participants.length > 0, "No participants");

        uint256 deposit = ISomniaPlatform(somniaPlatform).getRequestDeposit();
        uint256 jsonCost = deposit + JSON_FETCH_COST * 3;
        uint256 llmCost = deposit + LLM_INFERENCE_COST * 3;
        uint256 totalCost = jsonCost + llmCost;
        require(msg.value >= totalCost, "Insufficient payment for agents");

        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchString.selector,
            statsApiUrl,
            "stats"
        );

        _statsRequestId = ISomniaPlatform(somniaPlatform).createRequest{value: jsonCost}(
            JSON_API_AGENT_ID,
            address(this),
            this.handleStatsResponse.selector,
            payload
        );

        emit AgentStatsRequested(_statsRequestId);
    }

    function handleStatsResponse(
        uint256 requestId,
        ISomniaPlatform.Response[] memory responses,
        ISomniaPlatform.ResponseStatus status,
        ISomniaPlatform.Request memory
    ) external {
        require(msg.sender == address(somniaPlatform), "Only platform can call");
        require(requestId == _statsRequestId, "Wrong request ID");

        if (status != ISomniaPlatform.ResponseStatus.Success || responses.length == 0) {
            emit AgentSettlementFailed("Stats fetch agent failed");
            return;
        }

        string memory rawStats = abi.decode(responses[0].result, (string));
        PlayerStat[] memory stats = _parseStatsString(rawStats);

        _computeScores(stats);

        _requestReceiptAgent();
    }

    function _requestReceiptAgent() internal {
        string memory winnerScoreStr = _intToString(highestScore);
        string memory prompt = string.concat(
            "Fantasy match settled. Winner scored ", winnerScoreStr, " points. ",
            "Generate a brief 1-2 sentence receipt explaining the winner's performance."
        );

        string[] memory emptyOptions;
        bytes memory payload = abi.encodeWithSelector(
            ILlmInferenceAgent.inferString.selector,
            "You are a fantasy football settlement agent. Summarise why the winner won.",
            prompt,
            emptyOptions
        );

        uint256 deposit = ISomniaPlatform(somniaPlatform).getRequestDeposit();
        uint256 llmCost = deposit + LLM_INFERENCE_COST * 3;
        require(address(this).balance >= llmCost, "Insufficient balance for LLM agent");

        _receiptRequestId = ISomniaPlatform(somniaPlatform).createRequest{value: llmCost}(
            LLM_INFERENCE_AGENT_ID,
            address(this),
            this.handleReceiptResponse.selector,
            payload
        );

        emit AgentReceiptRequested(_receiptRequestId);
    }

    function handleReceiptResponse(
        uint256 requestId,
        ISomniaPlatform.Response[] memory responses,
        ISomniaPlatform.ResponseStatus status,
        ISomniaPlatform.Request memory
    ) external {
        require(msg.sender == address(somniaPlatform), "Only platform can call");
        require(requestId == _receiptRequestId, "Wrong request ID");

        if (status != ISomniaPlatform.ResponseStatus.Success || responses.length == 0) {
            emit AgentSettlementFailed("Receipt generation agent failed");
            settled = true;
            emit MatchSettled(winner, highestScore, latestStatsHash);
            return;
        }

        latestReceipt = abi.decode(responses[0].result, (string));
        settled = true;

        emit MatchSettled(winner, highestScore, latestStatsHash);
    }

    function onAgentResponse(
        bytes32 statsHash,
        PlayerStat[] calldata stats,
        string calldata receiptText
    ) external onlyCreator {
        require(locked, "Room not locked");
        require(!settled, "Already settled");
        require(participants.length > 0, "No participants");

        latestStatsHash = statsHash;
        latestReceipt = receiptText;

        _calculateScores(stats);
        settled = true;

        emit MatchSettled(winner, highestScore, statsHash);
    }

    function claimPrize() external {
        require(settled, "Room not settled");
        require(msg.sender == winner, "Only winner");
        require(!payoutComplete, "Already claimed");

        payoutComplete = true;
        uint256 amount = prizePool;
        prizePool = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Prize transfer failed");

        emit PrizeClaimed(msg.sender, amount);
    }

    function getLineup(address participant) external view returns (uint256[] memory) {
        return _lineups[participant];
    }

    function getParticipants() external view returns (address[] memory) {
        return participants;
    }

    receive() external payable {}

    function _validateLineup(uint256[] calldata playerIds, uint256 captainId) internal view {
        require(playerIds.length == LINEUP_SIZE, "Lineup must have 5 players");

        bool captainIncluded = false;
        uint256 goalkeepers = 0;
        uint256 defenders = 0;
        uint256 midfielders = 0;
        uint256 forwards = 0;

        for (uint256 i = 0; i < playerIds.length; i++) {
            uint256 playerId = playerIds[i];
            require(_isUnique(playerIds, i), "Duplicate player");
            require(registry.isValidPlayer(matchId, playerId), "Invalid player");

            if (playerId == captainId) {
                captainIncluded = true;
            }

            PlayerRegistry.Position position = registry.getPlayerPosition(matchId, playerId);
            if (position == PlayerRegistry.Position.Goalkeeper) {
                goalkeepers++;
            } else if (position == PlayerRegistry.Position.Defender) {
                defenders++;
            } else if (position == PlayerRegistry.Position.Midfielder) {
                midfielders++;
            } else if (position == PlayerRegistry.Position.Forward) {
                forwards++;
            }
        }

        require(captainIncluded, "Captain must be in lineup");
        require(goalkeepers == 1, "Need 1 goalkeeper");
        require(defenders == 1, "Need 1 defender");
        require(midfielders == 2, "Need 2 midfielders");
        require(forwards == 1, "Need 1 forward");
    }

    function _isUnique(uint256[] calldata playerIds, uint256 currentIndex) internal pure returns (bool) {
        for (uint256 j = 0; j < currentIndex; j++) {
            if (playerIds[j] == playerIds[currentIndex]) {
                return false;
            }
        }
        return true;
    }

    function _computeScores(PlayerStat[] memory stats) internal {
        highestScore = type(int256).min;
        winner = address(0);

        for (uint256 i = 0; i < participants.length; i++) {
            address participant = participants[i];
            require(lineupSubmitted[participant], "Missing lineup for participant");

            uint256[] storage lineup = _lineups[participant];
            int256 totalScore = 0;

            for (uint256 j = 0; j < lineup.length; j++) {
                uint256 playerId = lineup[j];
                PlayerStat memory stat = _findStatMemory(stats, playerId);
                int256 points = _scorePlayer(stat, registry.getPlayerPosition(matchId, playerId));

                if (captainOf[participant] == playerId) {
                    points *= CAPTAIN_MULTIPLIER;
                }

                totalScore += points;
            }

            scores[participant] = totalScore;

            if (winner == address(0) || totalScore > highestScore) {
                highestScore = totalScore;
                winner = participant;
            }
        }
    }

    function _calculateScores(PlayerStat[] calldata stats) internal {
        highestScore = type(int256).min;
        winner = address(0);

        for (uint256 i = 0; i < participants.length; i++) {
            address participant = participants[i];
            require(lineupSubmitted[participant], "Missing lineup for participant");

            uint256[] storage lineup = _lineups[participant];
            int256 totalScore = 0;

            for (uint256 j = 0; j < lineup.length; j++) {
                uint256 playerId = lineup[j];
                PlayerStat calldata stat = _findStat(stats, playerId);
                int256 points = _scorePlayer(stat, registry.getPlayerPosition(matchId, playerId));

                if (captainOf[participant] == playerId) {
                    points *= CAPTAIN_MULTIPLIER;
                }

                totalScore += points;
            }

            scores[participant] = totalScore;

            if (winner == address(0) || totalScore > highestScore) {
                highestScore = totalScore;
                winner = participant;
            }
        }
    }

    function _scorePlayer(
        PlayerStat calldata stat,
        PlayerRegistry.Position position
    ) internal pure returns (int256) {
        int256 points = 0;

        points += int256(uint256(stat.goals)) * GOAL_POINTS;
        points += int256(uint256(stat.assists)) * ASSIST_POINTS;
        points += int256(uint256(stat.yellowCards)) * YELLOW_CARD_POINTS;
        points += int256(uint256(stat.redCards)) * RED_CARD_POINTS;

        if (stat.minutesPlayed >= 60) {
            points += MINUTES_60_PLUS_POINTS;
        }

        if (
            stat.cleanSheet &&
            (position == PlayerRegistry.Position.Goalkeeper || position == PlayerRegistry.Position.Defender)
        ) {
            points += CLEAN_SHEET_POINTS;
        }

        return points;
    }

    function _scorePlayer(
        PlayerStat memory stat,
        PlayerRegistry.Position position
    ) internal pure returns (int256) {
        int256 points = 0;

        points += int256(uint256(stat.goals)) * GOAL_POINTS;
        points += int256(uint256(stat.assists)) * ASSIST_POINTS;
        points += int256(uint256(stat.yellowCards)) * YELLOW_CARD_POINTS;
        points += int256(uint256(stat.redCards)) * RED_CARD_POINTS;

        if (stat.minutesPlayed >= 60) {
            points += MINUTES_60_PLUS_POINTS;
        }

        if (
            stat.cleanSheet &&
            (position == PlayerRegistry.Position.Goalkeeper || position == PlayerRegistry.Position.Defender)
        ) {
            points += CLEAN_SHEET_POINTS;
        }

        return points;
    }

    function _findStat(
        PlayerStat[] calldata stats,
        uint256 playerId
    ) internal pure returns (PlayerStat calldata matchedStat) {
        for (uint256 i = 0; i < stats.length; i++) {
            if (stats[i].playerId == playerId) {
                return stats[i];
            }
        }

        revert("Missing stat for player");
    }

    function _findStatMemory(
        PlayerStat[] memory stats,
        uint256 playerId
    ) internal pure returns (PlayerStat memory matchedStat) {
        for (uint256 i = 0; i < stats.length; i++) {
            if (stats[i].playerId == playerId) {
                return stats[i];
            }
        }

        revert("Missing stat for player");
    }

    function _parseStatsString(string memory data) internal pure returns (PlayerStat[] memory stats) {
        bytes memory b = bytes(data);
        if (b.length == 0) {
            return stats;
        }

        uint256 commaCount = 0;
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == ',') commaCount++;
        }

        uint256 count = commaCount + 1;
        stats = new PlayerStat[](count);

        uint256 pos = 0;
        for (uint256 p = 0; p < count; p++) {
            stats[p] = PlayerStat({
                playerId: _parseUint(b, pos),
                goals: uint8(0),
                assists: uint8(0),
                yellowCards: uint8(0),
                redCards: uint8(0),
                cleanSheet: false,
                minutesPlayed: uint16(0)
            });

            pos = _skipTo(b, pos, ':');
            if (pos < b.length) pos++;
            stats[p].goals = uint8(_parseUint(b, pos));

            pos = _skipTo(b, pos, ':');
            if (pos < b.length) pos++;
            stats[p].assists = uint8(_parseUint(b, pos));

            pos = _skipTo(b, pos, ':');
            if (pos < b.length) pos++;
            stats[p].yellowCards = uint8(_parseUint(b, pos));

            pos = _skipTo(b, pos, ':');
            if (pos < b.length) pos++;
            stats[p].redCards = uint8(_parseUint(b, pos));

            pos = _skipTo(b, pos, ':');
            if (pos < b.length) pos++;
            stats[p].cleanSheet = _parseUint(b, pos) == 1;

            pos = _skipTo(b, pos, ':');
            if (pos < b.length) pos++;
            stats[p].minutesPlayed = uint16(_parseUint(b, pos));

            pos = _skipTo(b, pos, ',');
            if (pos < b.length && b[pos] == ',') pos++;
        }
    }

    function _parseUint(bytes memory b, uint256 start) internal pure returns (uint256 value) {
        while (start < b.length && b[start] >= '0' && b[start] <= '9') {
            value = value * 10 + uint256(uint8(b[start]) - 48);
            start++;
        }
    }

    function _skipTo(bytes memory b, uint256 start, uint8 delimiter) internal pure returns (uint256) {
        while (start < b.length && b[start] != delimiter) {
            start++;
        }
        return start;
    }

    function _intToString(int256 value) internal pure returns (string memory) {
        if (value == 0) return "0";

        bool negative = value < 0;
        uint256 absValue = negative ? uint256(-value) : uint256(value);

        uint256 temp = absValue;
        uint256 digits;
        while (temp > 0) {
            digits++;
            temp /= 10;
        }
        if (negative) digits++;

        bytes memory result = new bytes(digits);
        temp = absValue;
        uint256 index = digits;
        while (temp > 0) {
            index--;
            result[index] = bytes1(uint8(48 + (temp % 10)));
            temp /= 10;
        }
        if (negative) {
            result[0] = '-';
        }

        return string(result);
    }
}
