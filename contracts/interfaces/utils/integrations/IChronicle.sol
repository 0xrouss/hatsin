// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title IChronicle
 *
 * @notice Interface for Chronicle Protocol's oracle products
 */
interface IChronicle {
    /// @notice Returns the oracle's identifier.
    /// @return wat The oracle's identifier.
    function wat() external view returns (bytes32 wat);

    /// @notice Returns the oracle's current value.
    /// @dev Reverts if no value set.
    /// @return value The oracle's current value.
    function read() external view returns (uint value);

    /// @notice Returns the oracle's current value and its age.
    /// @dev Reverts if no value set.
    /// @return value The oracle's current value.
    /// @return age The value's age.
    function readWithAge() external view returns (uint value, uint age);

    /// @notice Returns the oracle's current value.
    /// @return isValid True if value exists, false otherwise.
    /// @return value The oracle's current value if it exists, zero otherwise.
    function tryRead() external view returns (bool isValid, uint value);

    /// @notice Returns the oracle's current value and its age.
    /// @return isValid True if value exists, false otherwise.
    /// @return value The oracle's current value if it exists, zero otherwise.
    /// @return age The value's age if value exists, zero otherwise.
    function tryReadWithAge()
        external
        view
        returns (bool isValid, uint value, uint age);
}


interface ISelfKisser {
    /// @notice Thrown if SelfKisser dead.
    error Dead();

    /// @notice Thrown if oracle not supported.
    /// @param oracle The oracle not supported.
    error OracleNotSupported(address oracle);

    /// @notice Emitted when SelfKisser killed.
    /// @param caller The caller's address.
    event Killed(address indexed caller);

    /// @notice Emitted when support for oracle added.
    /// @param caller The caller's address.
    /// @param oracle The oracle that support got added.
    event OracleSupported(address indexed caller, address indexed oracle);

    /// @notice Emitted when support for oracle removed.
    /// @param caller The caller's address.
    /// @param oracle The oracle that support got removed.
    event OracleUnsupported(address indexed caller, address indexed oracle);

    /// @notice Emitted when new address kissed on an oracle.
    /// @param caller The caller's address.
    /// @param oracle The oracle on which address `who` got kissed on.
    /// @param who The address that got kissed on oracle `oracle`.
    event SelfKissed(
        address indexed caller, address indexed oracle, address indexed who
    );

    // -- User Functionality --

    /// @notice Kisses caller on oracle `oracle`.
    ///
    /// @dev Reverts if oracle `oracle` not supported.
    /// @dev Reverts if SelfKisser dead.
    ///
    /// @param oracle The oracle to kiss the caller on.
    function selfKiss(address oracle) external;

    /// @notice Kisses address `who` on oracle `oracle`.
    ///
    /// @dev Reverts if oracle `oracle` not supported.
    /// @dev Reverts if SelfKisser dead.
    ///
    /// @param oracle The oracle to kiss address `who` on.
    /// @param who The address to kiss on oracle `oracle`.
    function selfKiss(address oracle, address who) external;

    // -- View Functionality --

    /// @notice Returns whether oracle `oracle` is supported.
    /// @param oracle The oracle to check whether its supported.
    /// @return True if oracle supported, false otherwise.
    function oracles(address oracle) external view returns (bool);

    /// @notice Returns the list of supported oracles.
    ///
    /// @dev May contain duplicates.
    ///
    /// @return List of supported oracles.
    function oracles() external view returns (address[] memory);

    /// @notice Returns whether SelfKisser is dead.
    /// @return True if SelfKisser dead, false otherwise.
    function dead() external view returns (bool);

    // -- Auth'ed Functionality --

    /// @notice Adds support for oracle `oracle`.
    /// @dev Only callable by auth'ed address.
    ///
    /// @dev Reverts if SelfKisser not auth'ed on oracle `oracle`.
    /// @dev Reverts if SelfKisser dead.
    ///
    /// @param oracle The oracle to add support for.
    function support(address oracle) external;

    /// @notice Removes support for oracle `oracle`.
    /// @dev Only callable by auth'ed address.
    ///
    /// @dev Reverts if SelfKisser dead.
    ///
    /// @param oracle The oracle to remove support for.
    function unsupport(address oracle) external;

    /// @notice Kills the contract.
    /// @dev Only callable by auth'ed address.
    function kill() external;
}


interface IScribe is IChronicle {
    /// @dev PokeData encapsulates a value and its age.
    struct PokeData {
        uint128 val;
        uint32 age;
    }

    /// @dev SchnorrData encapsulates a (aggregated) Schnorr signature.
    ///      Schnorr signatures are used to prove a PokeData's integrity.
    struct SchnorrData {
        bytes32 signature;
        address commitment;
        bytes feedIds;
    }

    /// @dev ECDSAData encapsulates an ECDSA signature.
    struct ECDSAData {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    /// @notice Thrown if a poked value's age is not greater than the oracle's
    ///         current value's age.
    /// @param givenAge The poked value's age.
    /// @param currentAge The oracle's current value's age.
    error StaleMessage(uint32 givenAge, uint32 currentAge);

    /// @notice Thrown if a poked value's age is greater than the current
    ///         time.
    /// @param givenAge The poked value's age.
    /// @param currentTimestamp The current time.
    error FutureMessage(uint32 givenAge, uint32 currentTimestamp);

    /// @notice Thrown if Schnorr signature not signed by exactly bar many
    ///         signers.
    /// @param numberSigners The number of signers for given Schnorr signature.
    /// @param bar The bar security parameter.
    error BarNotReached(uint8 numberSigners, uint8 bar);

    /// @notice Thrown if given feed id invalid.
    /// @param feedId The invalid feed id.
    error InvalidFeedId(uint8 feedId);

    /// @notice Thrown if double signing attempted.
    /// @param feedId The id of the feed attempting to double sign.
    error DoubleSigningAttempted(uint8 feedId);

    /// @notice Thrown if Schnorr signature verification failed.
    error SchnorrSignatureInvalid();

    /// @notice Emitted when oracle was successfully poked.
    /// @param caller The caller's address.
    /// @param val The value poked.
    /// @param age The age of the value poked.
    event Poked(address indexed caller, uint128 val, uint32 age);

    /// @notice Emitted when new feed lifted.
    /// @param caller The caller's address.
    /// @param feed The feed address lifted.
    event FeedLifted(address indexed caller, address indexed feed);

    /// @notice Emitted when feed dropped.
    /// @param caller The caller's address.
    /// @param feed The feed address dropped.
    event FeedDropped(address indexed caller, address indexed feed);

    /// @notice Emitted when bar updated.
    /// @param caller The caller's address.
    /// @param oldBar The old bar's value.
    /// @param newBar The new bar's value.
    event BarUpdated(address indexed caller, uint8 oldBar, uint8 newBar);

    /// @notice Returns the feed registration message.
    /// @dev This message must be signed by a feed in order to be lifted.
    /// @return feedRegistrationMessage Chronicle Protocol's feed registration
    ///                                 message.
    function feedRegistrationMessage()
        external
        view
        returns (bytes32 feedRegistrationMessage);

    /// @notice Returns the bar security parameter.
    /// @return bar The bar security parameter.
    function bar() external view returns (uint8 bar);

    /// @notice Returns the number of decimals of the oracle's value.
    /// @dev Provides partial compatibility with Chainlink's
    ///      IAggregatorV3Interface.
    /// @return decimals The oracle value's number of decimals.
    function decimals() external view returns (uint8 decimals);

    /// @notice Returns the oracle's latest value.
    /// @dev Provides partial compatibility with Chainlink's
    ///      IAggregatorV3Interface.
    /// @return roundId 1.
    /// @return answer The oracle's latest value.
    /// @return startedAt 0.
    /// @return updatedAt The timestamp of oracle's latest update.
    /// @return answeredInRound 1.
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int answer,
            uint startedAt,
            uint updatedAt,
            uint80 answeredInRound
        );

    /// @notice Returns the oracle's latest value.
    /// @dev Provides partial compatibility with Chainlink's
    ///      IAggregatorV3Interface.
    /// @custom:deprecated See https://docs.chain.link/data-feeds/api-reference/#latestanswer.
    /// @return answer The oracle's latest value.
    function latestAnswer() external view returns (int);

    /// @notice Pokes the oracle.
    /// @dev Expects `pokeData`'s age to be greater than the timestamp of the
    ///      last successful poke.
    /// @dev Expects `pokeData`'s age to not be greater than the current time.
    /// @dev Expects `schnorrData` to prove `pokeData`'s integrity.
    ///      See `isAcceptableSchnorrSignatureNow(bytes32,SchnorrData)(bool)`.
    /// @param pokeData The PokeData being poked.
    /// @param schnorrData The SchnorrData proving the `pokeData`'s
    ///                    integrity.
    function poke(PokeData calldata pokeData, SchnorrData calldata schnorrData)
        external;

    /// @notice Returns whether the Schnorr signature `schnorrData` is
    ///         currently acceptable for message `message`.
    /// @dev Note that a valid Schnorr signature is only acceptable if the
    ///      signature was signed by exactly bar many feeds.
    ///      For more info, see `bar()(uint8)` and `feeds()(address[])`.
    /// @dev Note that bar and feeds are configurable, meaning a once acceptable
    ///      Schnorr signature may become unacceptable in the future.
    /// @param message The message expected to be signed via `schnorrData`.
    /// @param schnorrData The SchnorrData to verify whether it proves
    ///                    the `message`'s integrity.
    /// @return ok True if Schnorr signature is acceptable, false otherwise.
    function isAcceptableSchnorrSignatureNow(
        bytes32 message,
        SchnorrData calldata schnorrData
    ) external view returns (bool ok);

    /// @notice Returns the message expected to be signed via Schnorr for
    ///         `pokeData`.
    /// @dev The message is defined as:
    ///         H(tag ‖ H(wat ‖ pokeData)), where H() is the keccak256 function.
    /// @param pokeData The pokeData to create the message for.
    /// @return pokeMessage Message for `pokeData`.
    function constructPokeMessage(PokeData calldata pokeData)
        external
        view
        returns (bytes32 pokeMessage);

    /// @notice Returns whether address `who` is a feed.
    /// @param who The address to check.
    /// @return isFeed True if `who` is feed, false otherwise.
    function feeds(address who) external view returns (bool isFeed);

    /// @notice Returns whether feed id `feedId` is a feed and, if so, the
    ///         feed's address.
    /// @param feedId The feed id to check.
    /// @return isFeed True if `feedId` is a feed, false otherwise.
    /// @return feed Address of the feed with id `feedId` if `feedId` is a feed,
    ///              zero-address otherwise.
    function feeds(uint8 feedId)
        external
        view
        returns (bool isFeed, address feed);

    /// @notice Returns list of feed addresses.
    /// @dev Note that this function has a high gas consumption and is not
    ///      intended to be called onchain.
    /// @return feeds List of feed addresses.
    function feeds() external view returns (address[] memory feeds);

    /// @notice Drops feed with id `feedId`.
    /// @dev Only callable by auth'ed address.
    /// @param feedId The feed id to drop.
    function drop(uint8 feedId) external;

    /// @notice Drops feeds with ids' `feedIds`.
    /// @dev Only callable by auth'ed address.
    /// @param feedIds The feed ids to drop.
    function drop(uint8[] memory feedIds) external;

    /// @notice Updates the bar security parameters to `bar`.
    /// @dev Only callable by auth'ed address.
    /// @dev Reverts if `bar` is zero.
    /// @param bar The value to update bar to.
    function setBar(uint8 bar) external;

    /// @notice Returns the oracle's current value.
    /// @custom:deprecated Use `tryRead()(bool,uint)` instead.
    /// @return value The oracle's current value if it exists, zero otherwise.
    /// @return isValid True if value exists, false otherwise.
    function peek() external view returns (uint value, bool isValid);

    /// @notice Returns the oracle's current value.
    /// @custom:deprecated Use `tryRead()(bool,uint)` instead.
    /// @return value The oracle's current value if it exists, zero otherwise.
    /// @return isValid True if value exists, false otherwise.
    function peep() external view returns (uint value, bool isValid);
}