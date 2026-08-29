const crypto = require("crypto");

class HyperLogLog {
    constructor() {
        this.m = 128;
        this.registers = new Uint8Array(this.m);
    }

    hash(value) {
        return crypto
            .createHash("sha256")
            .update(String(value))
            .digest();
    }
add(value) {
    const hashBuffer = this.hash(value);

    const index = hashBuffer[0] >> 1;

    let rank = 1;

    if ((hashBuffer[0] & 1) === 0) {
        rank = 2;

        for (let byteIndex = 1; byteIndex < hashBuffer.length; byteIndex++) {
            const byte = hashBuffer[byteIndex];

            if (byte === 0) {
                rank += 8;
                continue;
            }

            const leadingZeros = Math.clz32(byte) - 24;
            rank += leadingZeros;
            break;
        }
    }

    this.registers[index] = Math.max(
        this.registers[index],
        rank
    );
}
     
    estimate() {
        let sum = 0;

        for (const register of this.registers) {
            sum += Math.pow(2, -register);
        }

        const alpha = 0.7213 / (1 + 1.079 / this.m);

        const estimate =
            alpha * this.m * this.m / sum;

        const zeroRegisters = this.registers.filter(
            register => register === 0
        ).length;

        if (estimate <= 2.5 * this.m && zeroRegisters > 0) {
            return this.m * Math.log(this.m / zeroRegisters);
        }

        return estimate;
    }
}

module.exports = HyperLogLog;