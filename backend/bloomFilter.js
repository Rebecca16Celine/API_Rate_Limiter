const crypto = require("crypto");

class BloomFilter {
    constructor(size = 10000, hashCount = 3) {
        this.size = size;
        this.hashCount = hashCount;
        this.bits = new Uint8Array(size);
    }

    hash(value, seed) {
        return crypto
            .createHash("sha256")
            .update(`${seed}:${value}`)
            .digest()
            .readUInt32BE(0);
    }

    add(value) {
        for (let i = 0; i < this.hashCount; i++) {
            const index = this.hash(value, i) % this.size;
            this.bits[index] = 1;
        }
    }

    mightContain(value) {
        for (let i = 0; i < this.hashCount; i++) {
            const index = this.hash(value, i) % this.size;

            if (this.bits[index] === 0) {
                return false;
            }
        }

        return true;
    }
}

module.exports = BloomFilter;