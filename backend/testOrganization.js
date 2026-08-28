const GatewayMeter =
    require("./gatewayMeter");

const Organization =
    require("./organization");


const gateway =
    new GatewayMeter();

const organization =
    new Organization(
        "Organization A",
        10
    );


console.log("\n--- Request 1 ---");

const request1 =
    "request-1";

gateway.recordRequest(
    organization.name
);

organization.recordRequest(
    request1,
    true
);


console.log("\n--- Request 2 ---");

const request2 =
    "request-2";

gateway.recordRequest(
    organization.name
);

organization.recordRequest(
    request2,
    true
);


console.log("\n--- Request 3 ---");

const request3 =
    "request-3";

gateway.recordRequest(
    organization.name
);

organization.recordRequest(
    request3,
    false
);


console.log("\n--- RESULTS ---");


console.log(
    "Gateway observed:",
    gateway.getOrganizationUsage(
        organization.name
    )
);


console.log(
    "Organization reported:",
    organization.reportedRequests
);


console.log(
    "HLL estimate:",
    organization.hll.estimate()
);


console.log(
    "Difference:",
    gateway.getOrganizationUsage(
        organization.name
    ) - organization.reportedRequests
);


console.log(
    "Quota status:",
    organization.getQuotaStatus()
);