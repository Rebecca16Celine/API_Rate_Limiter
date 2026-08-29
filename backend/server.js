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


        /*
         * Generate a request ID.
         *
         * If the client provides one,
         * use it.
         *
         * Otherwise generate one.
         */

        const requestId =
            req.body.requestId ||
            `request-${Date.now()}-${Math.random()}`;


        /*
         * IMPORTANT:
         *
         * Gateway Meter counts the request
         * independently.
         */

        const gatewayResult =
            gatewayMeter.recordRequest(
                organizationName
            );


        /*
         * Organization processes the request.
         *
         * shouldReport controls our demo
         * discrepancy scenario.
         *
         * In a real system this would come
         * from the organization's reporting
         * behavior, not a client-controlled flag.
         */

        const shouldReport =
            req.body.shouldReport !== false;


        const organizationResult =
            organization.recordRequest(
                requestId,
                shouldReport
            );


        /*
         * Current usage values
         */

        const gatewayObserved =
            gatewayMeter.getOrganizationUsage(
                organizationName
            );


        const organizationReported =
            organization.reportedRequests;


        const hllEstimate =
            organization.hll.estimate();


        /*
         * Compare independent gateway count
         * with organization reported count.
         */

        const difference =
            gatewayObserved -
            organizationReported;


        let status = "NORMAL";


        if (difference > 0) {

            status = "DISCREPANCY";

        }


        if (
            organizationReported >=
            organization.quota
        ) {

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

            status,

            organizationResult

        });

    }
);


// ----------------------------------------
// Dashboard API
// ----------------------------------------

app.get("/api/dashboard", (req, res) => {

    const dashboard = {};


    for (
        const [name, organization]
        of Object.entries(organizations)
    ) {

        const gatewayObserved =
            gatewayMeter.getOrganizationUsage(
                name
            );


        const organizationReported =
            organization.reportedRequests;


        const hllEstimate =
            organization.hll.estimate();


        const difference =
            gatewayObserved -
            organizationReported;


        let status = "NORMAL";


        if (difference > 0) {

            status = "DISCREPANCY";

        }


        if (
            organizationReported >=
            organization.quota
        ) {

            status = "QUOTA_BREACH";

        }


        dashboard[name] = {

            quota:
                organization.quota,

            gatewayObserved,

            organizationReported,

            hllEstimate,

            difference,

            status

        };

    }


    res.json(dashboard);

});


// ----------------------------------------
// Start server
// ----------------------------------------

const PORT = 5000;

app.listen(PORT, () => {

    console.log(
        `API Gateway running on port ${PORT}`
    );

});