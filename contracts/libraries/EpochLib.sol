// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

library EpochLib {
    function getCutOffStartTimestamp(uint256 epoch, uint256 granularity, uint256 epochSecs, uint256 cutoffSecs) internal pure returns (uint256) {
        // find last epoch index aligning with bucket size
        uint256 eG = getGranularityAdjustedEpochOffset(epoch, granularity);
        // substract cutoff time from: timestamp for the start of next epoch boundary
        return (eG + 1) * epochSecs - cutoffSecs;
    }

    function getWithdrawalRequestEpoch(uint256 timestamp, uint256 granularity, uint256 epochSecs, uint256 cutoffSecs) internal pure returns (uint256) {
        uint256 epochOffsetByCutoff = (timestamp + cutoffSecs) / epochSecs;
        uint256 granularityAdjustedEpochOffset = getGranularityAdjustedEpochOffset(epochOffsetByCutoff, granularity);
        return granularityAdjustedEpochOffset;
    }

    function getGranularityAdjustedEpochOffset(uint256 epoch, uint256 granularity) internal pure returns (uint256) {
        return ((epoch / granularity) * granularity) + (granularity - 1);
    }
}