const express = require("express");
const cors = require("cors");

const GatewayMeter = require("./gatewayMeter");
const Organization = require("./organization");

const app = express();

app.use(cors());
app.use(express.json());


// ----------------------------------------
// Blockchain Service
// ----------------------------------------

const BLOCKCHAIN_SERVICE =
    "http://127.0.0.1:8000";


// ----------------------------------------
// Gateway Meter
// ----------------------------------------

const gatewayMeter = new GatewayMeter();


// ----------------------------------------
// Organizations
// ----------------------------------------

const organizations = {

    "Organization A":
        new Organization(
            "Organization A",
            10000
        ),

    "Organization B":
        new Organization(
            "Organization B",
            10000
        )
};


// ----------------------------------------
// Helper: Blockchain Request
// ----------------------------------------

async function blockchainRequest(
    endpoint,
    data
) {

    try {

        const response = await fetch(
            `${BLOCKCHAIN_SERVICE}${endpoint}`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify(data)
            }
        );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.error ||
                "Blockchain request failed"
            );

        }


        return result;

    } catch (error) {

        console.error(
            "Blockchain service error:",
            error.message
        );

        return {
            success: false,
            error: error.message
        };
    }
}


// ----------------------------------------
// Health Check
// ----------------------------------------

app.get(
    "/api/health",
    (req, res) => {

        res.json({
            status: "OK",
            message:
                "API Gateway is running"
        });

    }
);


// ----------------------------------------
// API Gateway
// ----------------------------------------

app.post(
    "/api/request/:organization",
    async (req, res) => {

        const organizationName =
            req.params.organization;


        const organization =
            organizations[
                organizationName
            ];


        // --------------------------------
        // Check organization
        // --------------------------------

        if (!organization) {

            return res.status(404).json({

                error:
                    "Organization not found",

                availableOrganizations:
                    Object.keys(
                        organizations
                    )

            });

        }


        // --------------------------------
        // Request ID
        // --------------------------------

        const requestId =
            req.body.requestId ||
            `request-${Date.now()}-${Math.random()}`;


        // --------------------------------
        // Independent Gateway Meter
        // --------------------------------

        gatewayMeter.recordRequest(
            organizationName
        );


        // --------------------------------
        // Organization Processing
        // --------------------------------

        const shouldReport =
            req.body.shouldReport !== false;


        const organizationResult =
            organization.recordRequest(
                requestId,
                shouldReport
            );


        // --------------------------------
        // Current Usage
        // --------------------------------

        const gatewayObserved =
            gatewayMeter.getOrganizationUsage(
                organizationName
            );


        const organizationReported =
            organization.reportedRequests;


        const hllEstimate =
            organization.hll.estimate();


        // --------------------------------
        // Bloom Hash
        // --------------------------------

        const bloomHash =
            "0x" +
            organization.getBloomHash();


        // --------------------------------
        // Difference
        // --------------------------------

        const difference =
            gatewayObserved -
            organizationReported;


        // --------------------------------
        // Quota
        // --------------------------------

        const quotaBreached =
            gatewayObserved >=
            organization.quota;


        // --------------------------------
        // Status
        // --------------------------------

        let status = "NORMAL";


        if (difference > 0) {

            status = "DISCREPANCY";

        }


        if (quotaBreached) {

            status = "QUOTA_BREACH";

        }


        // --------------------------------
        // Blockchain Period
        // --------------------------------

        /*
         * For the demo, all requests made
         * during the same minute belong to
         * the same blockchain usage period.
         */

        const now = new Date();

        const period =
            now.toISOString()
                .slice(0, 16);


        // --------------------------------
        // Submit Gateway Observation
        // --------------------------------

        const gatewayBlockchain =
            await blockchainRequest(
                "/gateway-observation",
                {
                    organization:
                        organizationName,

                    period,

                    gatewayObserved,

                    hllEstimate,

                    bloomHash
                }
            );


        // --------------------------------
        // Submit Organization Report
        // --------------------------------

        const organizationBlockchain =
            await blockchainRequest(
                "/organization-report",
                {
                    organization:
                        organizationName,

                    period,

                    organizationReported
                }
            );


        // --------------------------------
        // Read Blockchain Record
        // --------------------------------

        let blockchainRecord = null;


        try {

            const recordResponse =
                await fetch(
                    `${BLOCKCHAIN_SERVICE}/usage-record` +
                    `?organization=${encodeURIComponent(
                        organizationName
                    )}` +
                    `&period=${encodeURIComponent(
                        period
                    )}`
                );


            blockchainRecord =
                await recordResponse.json();

        } catch (error) {

            blockchainRecord = {

                success: false,

                error:
                    error.message

            };

        }


        // --------------------------------
        // Final Response
        // --------------------------------

        res.json({

            success: true,

            requestId,

            organization:
                organizationName,

            gatewayObserved,

            organizationReported,

            hllEstimate,

            bloomHash,

            difference,

            quota:
                organization.quota,

            quotaBreached,

            status,

            organizationResult,

            blockchain: {

                period,

                gatewayObservation:
                    gatewayBlockchain,

                organizationReport:
                    organizationBlockchain,

                usageRecord:
                    blockchainRecord

            }

        });

    }
);


// ----------------------------------------
// Dashboard API
// ----------------------------------------

app.get(
    "/api/dashboard",
    async (req, res) => {

        const dashboard = {};


        for (
            const [name, organization]
            of Object.entries(
                organizations
            )
        ) {

            // ----------------------------
            // Gateway usage
            // ----------------------------

            const gatewayObserved =
                gatewayMeter.getOrganizationUsage(
                    name
                );


            // ----------------------------
            // Organization usage
            // ----------------------------

            const organizationReported =
                organization.reportedRequests;


            // ----------------------------
            // HLL
            // ----------------------------

            const hllEstimate =
                organization.hll.estimate();


            // ----------------------------
            // Bloom
            // ----------------------------

            const bloomHash =
                "0x" +
                organization.getBloomHash();


            // ----------------------------
            // Difference
            // ----------------------------

            const difference =
                gatewayObserved -
                organizationReported;


            // ----------------------------
            // Quota
            // ----------------------------

            const quotaBreached =
                gatewayObserved >=
                organization.quota;


            // ----------------------------
            // Status
            // ----------------------------

            let status = "NORMAL";


            if (difference > 0) {

                status =
                    "DISCREPANCY";

            }


            if (quotaBreached) {

                status =
                    "QUOTA_BREACH";

            }


            // ----------------------------
            // Dashboard data
            // ----------------------------

            dashboard[name] = {

                quota:
                    organization.quota,

                gatewayObserved,

                organizationReported,

                hllEstimate,

                bloomHash,

                difference,

                quotaBreached,

                status

            };

        }


        res.json(dashboard);

    }
);


// ----------------------------------------
// Start Server
// ----------------------------------------

const PORT = 5000;


app.listen(
    PORT,
    () => {

        console.log(
            `API Gateway running on port ${PORT}`
        );

    }
);