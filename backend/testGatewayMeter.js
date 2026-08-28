const GatewayMeter =
    require("./gatewayMeter");

const meter =
    new GatewayMeter();


console.log(
    meter.recordRequest(
        "Organization A"
    )
);

console.log(
    meter.recordRequest(
        "Organization A"
    )
);

console.log(
    meter.recordRequest(
        "Organization B"
    )
);

console.log(
    meter.recordRequest(
        "Organization A"
    )
);


console.log("\nTotal requests:");
console.log(
    meter.getTotalRequests()
);


console.log("\nOrganization usage:");
console.log(
    meter.getAllUsage()
);