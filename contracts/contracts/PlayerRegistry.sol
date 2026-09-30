// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract PlayerRegistry is Ownable {
    enum Position {
        Goalkeeper,
        Defender,
        Midfielder,
        Forward
    }

    struct Player {
        uint256 id;
        string name;
        string team;
        Position position;
        bool active;
        bool exists;
    }

    struct PlayerInput {
        uint256 id;
        string name;
        string team;
        Position position;
    }

    mapping(bytes32 => mapping(uint256 => Player)) private _playersByMatch;
    mapping(bytes32 => uint256[]) private _playerIdsByMatch;

    event PlayerAdded(bytes32 indexed matchId, uint256 indexed playerId, string name, Position position);
    event PlayerStatusUpdated(bytes32 indexed matchId, uint256 indexed playerId, bool active);

    constructor(address initialOwner) Ownable(initialOwner) {}

    // Open seeding: any wallet can register a real starting-XI pool for a
    // fixture (football data is public), which lets each room creator fund the
    // addPlayers gas with their own wallet instead of a shared deployer.
    // Duplicate player ids are rejected per match, so re-seeding a partially
    // seeded pool fails cleanly and the caller retries with only the missing
    // ids. Pool integrity is NOT a trust boundary here: setPlayerStatus (the
    // function that determines whether a registered player counts) stays
    // owner-only, so a garbage pool cannot influence scoring.
    function addPlayers(bytes32 matchId, PlayerInput[] calldata inputs) external {
        require(inputs.length > 0, "No players provided");

        for (uint256 i = 0; i < inputs.length; i++) {
            PlayerInput calldata input = inputs[i];
            require(input.id > 0, "Invalid player id");
            require(!_playersByMatch[matchId][input.id].exists, "Player already exists");

            _playersByMatch[matchId][input.id] = Player({
                id: input.id,
                name: input.name,
                team: input.team,
                position: input.position,
                active: true,
                exists: true
            });

            _playerIdsByMatch[matchId].push(input.id);
            emit PlayerAdded(matchId, input.id, input.name, input.position);
        }
    }

    function setPlayerStatus(bytes32 matchId, uint256 playerId, bool active) external onlyOwner {
        Player storage player = _playersByMatch[matchId][playerId];
        require(player.exists, "Player not found");

        player.active = active;
        emit PlayerStatusUpdated(matchId, playerId, active);
    }

    function isValidPlayer(bytes32 matchId, uint256 playerId) external view returns (bool) {
        Player storage player = _playersByMatch[matchId][playerId];
        return player.exists && player.active;
    }

    function getPlayerPosition(bytes32 matchId, uint256 playerId) external view returns (Position) {
        Player storage player = _playersByMatch[matchId][playerId];
        require(player.exists, "Player not found");
        require(player.active, "Player is inactive");
        return player.position;
    }

    function getPlayer(bytes32 matchId, uint256 playerId) external view returns (Player memory) {
        Player memory player = _playersByMatch[matchId][playerId];
        require(player.exists, "Player not found");
        return player;
    }

    function getMatchPlayerIds(bytes32 matchId) external view returns (uint256[] memory) {
        return _playerIdsByMatch[matchId];
    }
}
