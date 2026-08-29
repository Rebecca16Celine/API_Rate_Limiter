// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

contract UsageCommitment {
    struct Organization {
        bool registered;
        uint256 quota;          // max cumulative usage allowed
        uint256 usedQuota;      // cumulative usage committed so far
        address owner;
    }

    struct UsageRecord {
        bytes32 commitment;
        uint256 timestamp;
        uint256 reportedUsage;
    }

    address public admin;

    mapping(bytes32 => Organization) public organizations;
    mapping(bytes32 => mapping(uint256 => UsageRecord)) public usageRecords;

    event OrganizationRegistered(
        bytes32 indexed organizationId,
        address indexed owner,
        uint256 quota
    );

    event QuotaUpdated(
        bytes32 indexed organizationId,
        uint256 oldQuota,
        uint256 newQuota
    );

    event OrganizationOwnerUpdated(
        bytes32 indexed organizationId,
        address indexed oldOwner,
        address indexed newOwner
    );

    event UsageCommitted(
        bytes32 indexed organizationId,
        uint256 indexed period,
        bytes32 commitment,
        uint256 timestamp,
        uint256 reportedUsage,
        uint256 cumulativeUsage
    );

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier organizationExists(bytes32 organizationId) {
        require(
            organizations[organizationId].registered,
            "Organization not registered"
        );
        _;
    }

    modifier onlyOrganizationOwner(bytes32 organizationId) {
        require(
            organizations[organizationId].owner == msg.sender,
            "Not organization owner"
        );
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function registerOrganization(
        bytes32 organizationId,
        address owner,
        uint256 quota
    ) external onlyAdmin {
        require(
            !organizations[organizationId].registered,
            "Organization already registered"
        );
        require(owner != address(0), "Invalid owner");
        require(quota > 0, "Invalid quota");

        organizations[organizationId] = Organization({
            registered: true,
            quota: quota,
            usedQuota: 0,
            owner: owner
        });

        emit OrganizationRegistered(organizationId, owner, quota);
    }

    function updateQuota(
        bytes32 organizationId,
        uint256 newQuota
    ) external onlyAdmin organizationExists(organizationId) {
        require(newQuota > 0, "Invalid quota");

        uint256 oldQuota = organizations[organizationId].quota;
        organizations[organizationId].quota = newQuota;

        emit QuotaUpdated(organizationId, oldQuota, newQuota);
    }

    /// @notice Rotate the address allowed to submit usage for an organization.
    ///         Needed since there is otherwise no recovery path if an org's
    ///         key is lost or compromised.
    function updateOrganizationOwner(
        bytes32 organizationId,
        address newOwner
    ) external onlyAdmin organizationExists(organizationId) {
        require(newOwner != address(0), "Invalid owner");

        address oldOwner = organizations[organizationId].owner;
        organizations[organizationId].owner = newOwner;

        emit OrganizationOwnerUpdated(organizationId, oldOwner, newOwner);
    }

    /// @notice Accepts the output of the off-chain metering pipeline for a
    ///         given billing period. `commitment` must equal
    ///         keccak256(organizationId, period, reportedUsage), and the org's
    ///         cumulative usage (including this submission) must not exceed
    ///         its quota. Both checks are enforced on-chain so the recorded
    ///         usage is trustworthy independent of what the gateway decided.
    function submitUsageCommitment(
        bytes32 organizationId,
        uint256 period,
        bytes32 commitment,
        uint256 reportedUsage
    )
        external
        organizationExists(organizationId)
        onlyOrganizationOwner(organizationId)
    {
        require(commitment != bytes32(0), "Invalid commitment");
        require(
            usageRecords[organizationId][period].timestamp == 0,
            "Usage already submitted"
        );

        bytes32 expectedCommitment = keccak256(
            abi.encodePacked(organizationId, period, reportedUsage)
        );
        require(commitment == expectedCommitment, "Commitment mismatch");

        Organization storage org = organizations[organizationId];
        uint256 newUsedQuota = org.usedQuota + reportedUsage;
        require(newUsedQuota <= org.quota, "Quota exceeded");
        org.usedQuota = newUsedQuota;

        usageRecords[organizationId][period] = UsageRecord({
            commitment: commitment,
            timestamp: block.timestamp,
            reportedUsage: reportedUsage
        });

        emit UsageCommitted(
            organizationId,
            period,
            commitment,
            block.timestamp,
            reportedUsage,
            newUsedQuota
        );
    }

    /// @notice Independent audit check: recompute the commitment for a claimed
    ///         usage value and compare it to what was stored on submission.
    function verifyUsage(
        bytes32 organizationId,
        uint256 period,
        uint256 usage
    ) external view organizationExists(organizationId) returns (bool) {
        UsageRecord memory record = usageRecords[organizationId][period];
        require(record.timestamp != 0, "No usage record");

        bytes32 calculatedCommitment = keccak256(
            abi.encodePacked(organizationId, period, usage)
        );

        return calculatedCommitment == record.commitment;
    }

    function getOrganization(
        bytes32 organizationId
    )
        external
        view
        returns (
            bool registered,
            uint256 quota,
            uint256 usedQuota,
            address owner
        )
    {
        Organization memory org = organizations[organizationId];
        return (org.registered, org.quota, org.usedQuota, org.owner);
    }

    function getUsageRecord(
        bytes32 organizationId,
        uint256 period
    )
        external
        view
        returns (
            bytes32 commitment,
            uint256 timestamp,
            uint256 reportedUsage
        )
    {
        UsageRecord memory record = usageRecords[organizationId][period];
        return (record.commitment, record.timestamp, record.reportedUsage);
    }
}
