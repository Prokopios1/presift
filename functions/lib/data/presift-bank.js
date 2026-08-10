"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bank = void 0;
const presift_bank_json_1 = __importDefault(require("./presift-bank.json"));
// We map it to any or explicitly cast it because TS complains about imported JSON lacking strict interface definitions sometimes.
exports.bank = presift_bank_json_1.default;
//# sourceMappingURL=presift-bank.js.map