const express = require("express");
const cors = require("cors");

const GatewayMeter = require("./gatewayMeter");
const Organization = require("./organization");

const app = express();

app.use(cors());
app.use(express.json());


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
// Health check
// ----------------------------------------

app.get("/api/health", (req, res) => {

    res.json({
        status: "OK",
        message: "API Gateway is running"
    });

});


// ----------------------------------------
// API Gateway
// ----------------------------------------

app.post(
    "/api/request/:organization",
    (req, res) => {

        const organizationName =
            req.params.organization;

        const organization =
            organizations[
                organizationName
            ];


        // Check organization
        if (!organization) {

            return res.status(404).json({

                error:
                    "Organization not found",

                availableOrganizations:
                    Object.keys(organizations)

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

        const gatewayResult =
            gatewayMeter.recordRequest(
                organizationName
            );


        // --------------------------------
        // Organization processing
        // --------------------------------

        /*
         * shouldReport is only being used
         * for our demonstration scenario.
         *
         * In a real system, reporting would
         * come from the organization's
         * reporting process.
         */

        const shouldReport =
            req.body.shouldReport !== false;


        const organizationResult =
            organization.recordRequest(
                requestId,
                shouldReport
            );


        // --------------------------------
        // Current usage
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
        // Compare usage
        // --------------------------------

        const difference =
            gatewayObserved -
            organizationReported;


        // --------------------------------
        // Quota check
        // --------------------------------

        /*
         * IMPORTANT:
         *
         * Quota is now checked against
         * the INDEPENDENT GATEWAY METER.
         *
         * This prevents an organization from
         * avoiding a quota breach simply by
         * reporting a lower usage value.
         */

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


        /*
         * Gateway usage is authoritative
         * for quota enforcement.
         */

        if (quotaBreached) {

            status = "QUOTA_BREACH";

        }


        // --------------------------------
        // Response
        // --------------------------------

        res.json({

            success: true,

            requestId,

            organization:
                organizationName,

            gatewayObserved,

            organizationReported,

            hllEstimate,

            difference,

            quota:
                organization.quota,

            quotaBreached,

            status,

            organizationResult

        });

    }
);


// ----------------------------------------
// Dashboard API
// ----------------------------------------

app.get(
    "/api/dashboard",
    (req, res) => {

        const dashboard = {};


        for (
            const [name, organization]
            of Object.entries(organizations)
        ) {

            // Independent gateway usage

            const gatewayObserved =
                gatewayMeter.getOrganizationUsage(
                    name
                );


            // Organization reported usage

            const organizationReported =
                organization.reportedRequests;


            // HLL estimate

            const hllEstimate =
                organization.hll.estimate();


            // Usage difference

            const difference =
                gatewayObserved -
                organizationReported;


            // --------------------------------
            // Quota check
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


            /*
             * IMPORTANT:
             *
             * Quota breach is determined
             * using gatewayObserved.
             */

            if (quotaBreached) {

                status = "QUOTA_BREACH";

            }


            dashboard[name] = {

                quota:
                    organization.quota,

                gatewayObserved,

                organizationReported,

                hllEstimate,

                difference,

                quotaBreached,

                status

            };

        }


        res.json(dashboard);

    }
);


// ----------------------------------------
// Start server
// ----------------------------------------

const PORT = 5000;

app.listen(PORT, () => {

    console.log(
        `API Gateway running on port ${PORT}`
    );

});