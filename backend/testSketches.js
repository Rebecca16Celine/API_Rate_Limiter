const BloomFilter = require("./bloomFilter");

const bloom = new BloomFilter();

bloom.add("request-1");
bloom.add("request-2");
bloom.add("request-3");

console.log("request-1:", bloom.mightContain("request-1"));
console.log("request-2:", bloom.mightContain("request-2"));
console.log("request-999:", bloom.mightContain("request-999"));