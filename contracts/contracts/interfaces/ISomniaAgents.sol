// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISomniaPlatform {
    enum ResponseStatus { Pending, Success, Failure, Timeout }
    enum ConsensusType { Majority, Threshold }

    struct Response {
        address responder;
        bytes result;
        bool success;
    }

    struct Request {
        uint256 requestId;
        address requester;
        address callbackAddress;
        bytes4 callbackSelector;
        address[] subcommittee;
        uint8 responseCount;
        uint8 failureCount;
        uint256 threshold;
        uint256 createdAt;
        uint256 deadline;
        ResponseStatus status;
        ConsensusType consensusType;
        uint256 remainingBudget;
        uint256 perAgentBudget;
    }

    function createRequest(
        uint256 agentId,
        address callbackAddress,
        bytes4 callbackSelector,
        bytes calldata payload
    ) external payable returns (uint256 requestId);

    function getRequestDeposit() external view returns (uint256);
    function hasRequest(uint256 requestId) external view returns (bool);
    function getRequest(uint256 requestId) external view returns (Request memory);
}

interface IJsonApiAgent {
    function fetchString(string calldata url, string calldata selector) external returns (string memory);
    function fetchUint(string calldata url, string calldata selector, uint8 decimals) external returns (uint256);
    function fetchInt(string calldata url, string calldata selector, uint8 decimals) external returns (int256);
    function fetchBool(string calldata url, string calldata selector) external returns (bool);
    function fetchStringArray(string calldata url, string calldata selector) external returns (string[] memory);
    function fetchUintArray(string calldata url, string calldata selector, uint8 decimals) external returns (uint256[] memory);
}

interface ILlmInferenceAgent {
    function inferString(
        string calldata systemPrompt,
        string calldata userPrompt,
        string[] calldata allowedValues
    ) external returns (string memory);

    function inferNumber(
        string calldata systemPrompt,
        string calldata userPrompt,
        int256 minValue,
        int256 maxValue
    ) external returns (int256);
}

interface ILlmParseWebsiteAgent {
    function ExtractString(
        string calldata key,
        string calldata description,
        string[] calldata options
    ) external returns (string memory);

    function ExtractANumber(
        string calldata key,
        string calldata description,
        int256 min,
        int256 max
    ) external returns (int256);
}
