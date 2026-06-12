// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FantasyMatchRoom} from "./FantasyMatchRoom.sol";

contract MatchRoomFactory {
    address public immutable somniaPlatform;
    address[] public allRooms;
    mapping(address => address[]) private _roomsByCreator;

    event RoomCreated(
        address indexed creator,
        address indexed room,
        bytes32 indexed matchId,
        uint256 entryFee,
        uint256 maxParticipants,
        uint256 lineupDeadline,
        address registry,
        address somniaPlatform
    );

    constructor(address somniaPlatform_) {
        somniaPlatform = somniaPlatform_;
    }

    function createRoom(
        bytes32 matchId,
        uint256 entryFee,
        uint256 maxParticipants,
        uint256 lineupDeadline,
        address registry
    ) external returns (address roomAddress) {
        FantasyMatchRoom room = new FantasyMatchRoom(
            msg.sender,
            registry,
            matchId,
            entryFee,
            maxParticipants,
            lineupDeadline,
            somniaPlatform
        );

        roomAddress = address(room);
        allRooms.push(roomAddress);
        _roomsByCreator[msg.sender].push(roomAddress);

        emit RoomCreated(
            msg.sender,
            roomAddress,
            matchId,
            entryFee,
            maxParticipants,
            lineupDeadline,
            registry,
            somniaPlatform
        );
    }

    function getRooms() external view returns (address[] memory) {
        return allRooms;
    }

    function getRoomsByCreator(address creator) external view returns (address[] memory) {
        return _roomsByCreator[creator];
    }

    function totalRooms() external view returns (uint256) {
        return allRooms.length;
    }
}
