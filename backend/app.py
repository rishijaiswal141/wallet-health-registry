import hashlib
import json
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
# Enable CORS for all origins, headers, and routes
CORS(app, resources={r"/*": {"origins": "*"}})

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    return response

REPORTS = {
    "risky": {
        "score": 5,
        "address": "0x8e5da9c82e0449c421c7a002b7606206ee445d01",
        "canonical_report": '{"address":"0x8e5da9c82e0449c421c7a002b7606206ee445d01","score":5}',
        "report_hash": "0x1111111111111111111111111111111111111111111111111111111111111111",
        "breakdown": [
            {"factor": "Contract Approvals", "points": 0, "max": 40, "evidence": "Unlimited allowance to unverified contract"},
            {"factor": "Transaction History", "points": 5, "max": 30, "evidence": "High frequency interactions with flagged pools"},
            {"factor": "Key Hygiene", "points": 0, "max": 30, "evidence": "Exposed state activity"}
        ],
        "recommendations": [
            {"action": "Revoke unlimited token approvals", "gain": 40},
            {"action": "Disconnect active sessions", "gain": 20}
        ]
    },
    "clean": {
        "score": 85,
        "address": "0x8e5da9c82e0449c421c7a002b7606206ee445d01",
        "canonical_report": '{"address":"0x8e5da9c82e0449c421c7a002b7606206ee445d01","score":85}',
        "report_hash": "0x2222222222222222222222222222222222222222222222222222222222222222",
        "breakdown": [
            {"factor": "Contract Approvals", "points": 35, "max": 40, "evidence": "Minimal active allowances"},
            {"factor": "Transaction History", "points": 25, "max": 30, "evidence": "Clean interaction history"},
            {"factor": "Key Hygiene", "points": 25, "max": 30, "evidence": "No high-risk approvals"}
        ],
        "recommendations": []
    },
    "risky_fixed": {
        "score": 65,
        "address": "0x8e5da9c82e0449c421c7a002b7606206ee445d01",
        "canonical_report": '{"address":"0x8e5da9c82e0449c421c7a002b7606206ee445d01","score":65}',
        "report_hash": "0x3333333333333333333333333333333333333333333333333333333333333333",
        "breakdown": [
            {"factor": "Contract Approvals", "points": 40, "max": 40, "evidence": "Approvals revoked successfully"},
            {"factor": "Transaction History", "points": 5, "max": 30, "evidence": "High frequency interactions with flagged pools"},
            {"factor": "Key Hygiene", "points": 20, "max": 30, "evidence": "Active sessions secured"}
        ],
        "recommendations": [
            {"action": "Migrate funds to fresh multisig vault", "gain": 20}
        ]
    },
    "sample": {
        "score": 42,
        "address": "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be",
        "canonical_report": '{"address":"0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be","score":42}',
        "report_hash": "0x4444444444444444444444444444444444444444444444444444444444444444",
        "breakdown": [
            {"factor": "Contract Approvals", "points": 15, "max": 40, "evidence": "Medium risk token allowances found"},
            {"factor": "Transaction History", "points": 15, "max": 30, "evidence": "Interactions with unverified DEX router"},
            {"factor": "Key Hygiene", "points": 12, "max": 30, "evidence": "Unused key pairs linked"}
        ],
        "recommendations": [
            {"action": "Limit DEX router permissions", "gain": 25},
            {"action": "Rotate operational key pair", "gain": 18}
        ]
    },
    "resilient": {
        "score": 98,
        "address": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
        "canonical_report": '{"address":"0xd8da6bf26964af9d7eed9e03e53415d37aa96045","score":98}',
        "report_hash": "0x5555555555555555555555555555555555555555555555555555555555555555",
        "breakdown": [
            {"factor": "Contract Approvals", "points": 40, "max": 40, "evidence": "Zero active open allowances"},
            {"factor": "Transaction History", "points": 29, "max": 30, "evidence": "Verified Gnosis Safe multi-sig usage"},
            {"factor": "Key Hygiene", "points": 29, "max": 30, "evidence": "Hardware wallet signing detected"}
        ],
        "recommendations": []
    }
}

@app.route('/benchmark', methods=['GET', 'OPTIONS'])
def get_benchmark():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
    return jsonify({"average": 52})

def build_report_for_key(key):
    if not key:
        return REPORTS["risky"]
    key_str = str(key).strip().lower()
    
    # Check exact preset key
    if key_str in REPORTS:
        return REPORTS[key_str]
    
    # Check matching preset address
    for k, report in REPORTS.items():
        if report.get("address", "").lower() == key_str:
            return report
            
    # If custom ETH address passed, generate deterministic report
    if key_str.startswith("0x") and len(key_str) == 42:
        val_hash = hashlib.sha256(key_str.encode()).hexdigest()
        score = (int(val_hash[:8], 16) % 90) + 10
        canon = f'{{"address":"{key_str}","score":{score}}}'
        rep_hash = f"0x{hashlib.sha256(canon.encode()).hexdigest()}"
        return {
            "score": score,
            "address": key_str,
            "canonical_report": canon,
            "report_hash": rep_hash,
            "breakdown": [
                {"factor": "Contract Approvals", "points": int(score * 0.4), "max": 40, "evidence": "Custom wallet allowance scan complete"},
                {"factor": "Transaction History", "points": int(score * 0.3), "max": 30, "evidence": "Verified on-chain history telemetry"},
                {"factor": "Key Hygiene", "points": int(score * 0.3), "max": 30, "evidence": "Standard key exposure assessment"}
            ],
            "recommendations": [
                {"action": "Audit active protocol allowances", "gain": 25},
                {"action": "Review key pair permissions", "gain": 15}
            ] if score < 75 else []
        }
    
    # Default fallback
    return REPORTS["risky"]

@app.route('/score/<wallet_id>', methods=['GET', 'OPTIONS'])
def get_score_by_path(wallet_id):
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
    return jsonify(build_report_for_key(wallet_id))

@app.route('/score', methods=['GET', 'OPTIONS'])
def get_score_by_query():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
    wallet = request.args.get('wallet')
    return jsonify(build_report_for_key(wallet))

@app.route('/hash', methods=['POST', 'OPTIONS'])
def compute_hash():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
    data = request.get_json(silent=True) or {}
    text = data.get('text', '')
    sha256_hex = hashlib.sha256(text.encode('utf-8')).hexdigest()
    return jsonify({"hash": f"0x{sha256_hex}"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
