from flask import Flask, request, jsonify

from blockchain_client import (
    submit_gateway_observation,
    submit_organization_report,
    get_usage_record,
    verify_usage,
    GATEWAY_ACCOUNT,
)


app = Flask(__name__)


# ----------------------------------------
# Health Check
# ----------------------------------------

@app.get("/health")
def health():
    return jsonify({
        "status": "OK",
        "message": "Blockchain service is running"
    })


# ----------------------------------------
# Gateway Observation
# ----------------------------------------

@app.post("/gateway-observation")
def gateway_observation():

    data = request.get_json()

    try:
        result = submit_gateway_observation(
            organization_name=data["organization"],
            period=data["period"],
            gateway_observed=int(data["gatewayObserved"]),
            hll_estimate=int(round(data["hllEstimate"])),
            bloom_hash=data["bloomHash"],
            from_account=GATEWAY_ACCOUNT
        )

        return jsonify({
            "success": True,
            "result": result
        })

    except Exception as exc:
        return jsonify({
            "success": False,
            "error": str(exc)
        }), 500


# ----------------------------------------
# Organization Report
# ----------------------------------------

@app.post("/organization-report")
def organization_report():

    data = request.get_json()

    try:
        result = submit_organization_report(
            organization_name=data["organization"],
            period=data["period"],
            organization_reported=int(
                data["organizationReported"]
            ),
            from_account=GATEWAY_ACCOUNT
        )

        return jsonify({
            "success": True,
            "result": result
        })

    except Exception as exc:
        return jsonify({
            "success": False,
            "error": str(exc)
        }), 500


# ----------------------------------------
# Read Usage Record
# ----------------------------------------

@app.get("/usage-record")
def usage_record():

    organization = request.args.get("organization")
    period = request.args.get("period")

    if not organization or not period:
        return jsonify({
            "success": False,
            "error": "organization and period are required"
        }), 400

    try:
        result = get_usage_record(
            organization,
            period
        )

        return jsonify({
            "success": True,
            "result": result
        })

    except Exception as exc:
        return jsonify({
            "success": False,
            "error": str(exc)
        }), 500


# ----------------------------------------
# Verify Usage
# ----------------------------------------

@app.post("/verify")
def verify():

    data = request.get_json()

    try:
        result = verify_usage(
            organization_name=data["organization"],
            period=data["period"],
            gateway_observed=int(
                data["gatewayObserved"]
            ),
            organization_reported=int(
                data["organizationReported"]
            ),
            hll_estimate=int(
                round(data["hllEstimate"])
            ),
            bloom_hash=data["bloomHash"]
        )

        return jsonify({
            "success": True,
            "verified": result
        })

    except Exception as exc:
        return jsonify({
            "success": False,
            "error": str(exc)
        }), 500


# ----------------------------------------
# Start Blockchain Service
# ----------------------------------------

if __name__ == "__main__":

    print("Starting blockchain service...")

    app.run(
        host="127.0.0.1",
        port=8000,
        debug=False
    )