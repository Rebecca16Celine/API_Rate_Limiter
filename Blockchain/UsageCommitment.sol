// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title UsageCommitment
/// @notice Records two independently-submitted usage figures per
///         organization/period and flags any discrepancy between them:
///
///           - organizationReported: submitted by the organization itself
///           - gatewayObserved:      submitted by the independent metering
///                                    gateway (Bloom filter + HyperLogLog)
///
///         Neither party can submit the other's value, and neither can
///         resubmit their own value once set. This is what makes the
///         discrepancy check meaningful -- if the org itself could set
///         both fields, it could always report zero discrepancy.
contract UsageCommitment {
    struct UsageRecord {
        uint256 gatewayObserved;
        uint256 organizationReported;
        uint256 hllEstimate;
        bytes32 bloomHash;
        uint256 difference;
        bool discrepancy;
        uint256 orgTimestamp;
        uint256 gatewayTimestamp;
        bool orgSubmitted;
        bool gatewaySubmitted;
    }

    address public admin;
    address public gateway;

    mapping(bytes32 => bool) public registeredOrganizations;
    mapping(bytes32 => address) public organizationOwners;
    mapping(bytes32 => uint256) public quotas;
    mapping(bytes32 => uint256) public usedQuotas; // cumulative gatewayObserved, once finalized

    mapping(bytes32 => mapping(bytes32 => UsageRecord)) private usageRecords;

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

    event GatewayUpdated(address indexed oldGateway, address indexed newGateway);

    event OrganizationReportSubmitted(
        bytes32 indexed organizationId,
        bytes32 indexed periodId,
        uint256 organizationReported,
        uint256 timestamp
    );

    event GatewayObservationSubmitted(
        bytes32 indexed organizationId,
        bytes32 indexed periodId,
        uint256 gatewayObserved,
        uint256 hllEstimate,
        bytes32 bloomHash,
        uint256 timestamp
    );

    event UsageFinalized(
        bytes32 indexed organizationId,
        bytes32 indexed periodId,
        uint256 gatewayObserved,
        uint256 organizationReported,
        uint256 difference,
        bool discrepancy,
        uint256 cumulativeUsage,
        bool overQuota
    );

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier onlyGateway() {
        require(msg.sender == gateway, "Only gateway");
        _;
    }

    modifier organizationExists(bytes32 organizationId) {
        require(registeredOrganizations[organizationId], "Organization not registered");
        _;
    }

    modifier onlyOrganizationOwner(bytes32 organizationId) {
        require(
            msg.sender == organizationOwners[organizationId],
            "Only organization owner"
        );
        _;
    }

    constructor(address gatewayAddress) {
        require(gatewayAddress != address(0), "Invalid gateway");
        admin = msg.sender;
        gateway = gatewayAddress;
    }

    // ---------------------------------------------------------------
    // Admin: organizations, quotas, roles
    // ---------------------------------------------------------------

    function registerOrganization(
        bytes32 organizationId,
        address owner,
        uint256 quota
    ) external onlyAdmin {
        require(!registeredOrganizations[organizationId], "Organization already registered");
        require(owner != address(0), "Invalid owner");
        require(quota > 0, "Invalid quota");

        registeredOrganizations[organizationId] = true;
        organizationOwners[organizationId] = owner;
        quotas[organizationId] = quota;

        emit OrganizationRegistered(organizationId, owner, quota);
    }

    function updateQuota(
        bytes32 organizationId,
        uint256 newQuota
    ) external onlyAdmin organizationExists(organizationId) {
        require(newQuota > 0, "Invalid quota");

        uint256 oldQuota = quotas[organizationId];
        quotas[organizationId] = newQuota;

        emit QuotaUpdated(organizationId, oldQuota, newQuota);
    }

    function updateOrganizationOwner(
        bytes32 organizationId,
        address newOwner
    ) external onlyAdmin organizationExists(organizationId) {
        require(newOwner != address(0), "Invalid owner");

        address oldOwner = organizationOwners[organizationId];
        organizationOwners[organizationId] = newOwner;

        emit OrganizationOwnerUpdated(organizationId, oldOwner, newOwner);
    }

    /// @notice Rotate the gateway address (e.g. if the metering
    ///         infrastructure's key is rotated or compromised).
    function updateGateway(address newGateway) external onlyAdmin {
        require(newGateway != address(0), "Invalid gateway");

        address oldGateway = gateway;
        gateway = newGateway;

        emit GatewayUpdated(oldGateway, newGateway);
    }

    // ---------------------------------------------------------------
    // Two-party usage submission
    // ---------------------------------------------------------------

    /// @notice Called by the organization itself to report its own usage
    ///         for a period. Can only be called once per organization/period
    ///         -- it cannot be revised after the fact, and it does not
    ///         overwrite or see the gateway's figure.
    function submitOrganizationReport(
        bytes32 organizationId,
        bytes32 periodId,
        uint256 organizationReported
    ) external organizationExists(organizationId) onlyOrganizationOwner(organizationId) {
        UsageRecord storage record = usageRecords[organizationId][periodId];
        require(!record.orgSubmitted, "Organization report already submitted");

        record.organizationReported = organizationReported;
        record.orgTimestamp = block.timestamp;
        record.orgSubmitted = true;

        emit OrganizationReportSubmitted(
            organizationId,
            periodId,
            organizationReported,
            block.timestamp
        );

        if (record.gatewaySubmitted) {
            _finalize(organizationId, periodId, record);
        }
    }

    /// @notice Called by the independent metering gateway to submit its
    ///         observed usage for a period (derived off-chain via Bloom
    ///         filter + HyperLogLog). Can only be called once per
    ///         organization/period.
    function submitGatewayObservation(
        bytes32 organizationId,
        bytes32 periodId,
        uint256 gatewayObserved,
        uint256 hllEstimate,
        bytes32 bloomHash
    ) external onlyGateway organizationExists(organizationId) {
        UsageRecord storage record = usageRecords[organizationId][periodId];
        require(!record.gatewaySubmitted, "Gateway observation already submitted");

        record.gatewayObserved = gatewayObserved;
        record.hllEstimate = hllEstimate;
        record.bloomHash = bloomHash;
        record.gatewayTimestamp = block.timestamp;
        record.gatewaySubmitted = true;

        emit GatewayObservationSubmitted(
            organizationId,
            periodId,
            gatewayObserved,
            hllEstimate,
            bloomHash,
            block.timestamp
        );

        if (record.orgSubmitted) {
            _finalize(organizationId, periodId, record);
        }
    }

    /// @dev Called once both sides are in. Computes the difference,
    ///      flags any discrepancy, and folds the gateway's (trusted)
    ///      figure into the organization's cumulative usage for quota
    ///      tracking. Quota overage is flagged, not reverted -- the
    ///      record is evidence, so it still needs to be written even
    ///      if the organization went over.
    function _finalize(
        bytes32 organizationId,
        bytes32 periodId,
        UsageRecord storage record
    ) private {
        uint256 difference = record.gatewayObserved >= record.organizationReported
            ? record.gatewayObserved - record.organizationReported
            : record.organizationReported - record.gatewayObserved;

        bool discrepancy = record.gatewayObserved != record.organizationReported;

        record.difference = difference;
        record.discrepancy = discrepancy;

        uint256 cumulativeUsage = usedQuotas[organizationId] + record.gatewayObserved;
        usedQuotas[organizationId] = cumulativeUsage;
        bool overQuota = cumulativeUsage > quotas[organizationId];

        emit UsageFinalized(
            organizationId,
            periodId,
            record.gatewayObserved,
            record.organizationReported,
            difference,
            discrepancy,
            cumulativeUsage,
            overQuota
        );
    }

    // ---------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------

    function getOrganization(
        bytes32 organizationId
    )
        external
        view
        returns (
            bool registered,
            address owner,
            uint256 quota,
            uint256 usedQuota
        )
    {
        return (
            registeredOrganizations[organizationId],
            organizationOwners[organizationId],
            quotas[organizationId],
            usedQuotas[organizationId]
        );
    }

    function getUsageRecord(
        bytes32 organizationId,
        bytes32 periodId
    )
        external
        view
        returns (
            uint256 gatewayObserved,
            uint256 organizationReported,
            uint256 hllEstimate,
            bytes32 bloomHash,
            uint256 difference,
            bool discrepancy,
            uint256 orgTimestamp,
            uint256 gatewayTimestamp,
            bool orgSubmitted,
            bool gatewaySubmitted
        )
    {
        UsageRecord memory record = usageRecords[organizationId][periodId];

        return (
            record.gatewayObserved,
            record.organizationReported,
            record.hllEstimate,
            record.bloomHash,
            record.difference,
            record.discrepancy,
            record.orgTimestamp,
            record.gatewayTimestamp,
            record.orgSubmitted,
            record.gatewaySubmitted
        );
    }

    /// @notice Re-check a claimed set of values against what's on-chain.
    ///         Only meaningful once both sides have submitted (i.e. the
    ///         record is finalized) -- returns false otherwise.
    function verifyUsage(
        bytes32 organizationId,
        bytes32 periodId,
        uint256 gatewayObserved,
        uint256 organizationReported,
        uint256 hllEstimate,
        bytes32 bloomHash
    ) external view returns (bool) {
        UsageRecord memory record = usageRecords[organizationId][periodId];

        if (!record.orgSubmitted || !record.gatewaySubmitted) {
            return false;
        }

        return (
            record.gatewayObserved == gatewayObserved &&
            record.organizationReported == organizationReported &&
            record.hllEstimate == hllEstimate &&
            record.bloomHash == bloomHash
        );
    }
}
