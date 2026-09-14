// Copyright (c) 2026 The MutantHub fixture authors
// Distributed under the MIT software license.

#include <script/interpreter.h>
#include <test/util/setup_common.h>

#include <boost/test/unit_test.hpp>

BOOST_FIXTURE_TEST_SUITE(script_tests, BasicTestingSetup)

static std::vector<unsigned char> Script(std::initializer_list<unsigned char> bytes)
{
    return std::vector<unsigned char>(bytes);
}

BOOST_AUTO_TEST_CASE(cast_to_bool)
{
    BOOST_CHECK(!CastToBool({}));
    BOOST_CHECK(!CastToBool({0x00}));
    BOOST_CHECK(!CastToBool({0x80}));            // negative zero
    BOOST_CHECK(!CastToBool({0x00, 0x00, 0x80})); // negative zero, longer
    BOOST_CHECK(CastToBool({0x01}));
    BOOST_CHECK(CastToBool({0x00, 0x01}));
}

BOOST_AUTO_TEST_CASE(minimal_push)
{
    BOOST_CHECK(CheckMinimalPush({}, OP_0));
    BOOST_CHECK(!CheckMinimalPush({}, OP_PUSHDATA1));
    BOOST_CHECK(!CheckMinimalPush({0x01}, static_cast<opcodetype>(1)));
    BOOST_CHECK(!CheckMinimalPush({0x81}, static_cast<opcodetype>(1)));
    BOOST_CHECK(CheckMinimalPush({0x17}, static_cast<opcodetype>(1)));
    BOOST_CHECK(CheckMinimalPush(std::vector<unsigned char>(75, 0xaa), static_cast<opcodetype>(75)));
    BOOST_CHECK(!CheckMinimalPush(std::vector<unsigned char>(76, 0xaa), static_cast<opcodetype>(76)));
    BOOST_CHECK(CheckMinimalPush(std::vector<unsigned char>(76, 0xaa), OP_PUSHDATA1));
}

BOOST_AUTO_TEST_CASE(eval_add_and_equal)
{
    std::vector<valtype> stack;
    ScriptError err;
    // OP_1 OP_1 OP_ADD OP_2 OP_EQUAL
    const auto script = Script({OP_1, OP_1, OP_ADD, static_cast<unsigned char>(OP_1 + 1), OP_EQUAL});
    BOOST_CHECK(EvalScript(stack, script, SCRIPT_VERIFY_NONE, &err));
    BOOST_CHECK_EQUAL(stack.size(), 1U);
    BOOST_CHECK(CastToBool(stack.back()));
}

BOOST_AUTO_TEST_CASE(verify_script_cleanstack)
{
    ScriptError err;
    const auto scriptSig = Script({OP_1, OP_1});
    const auto scriptPubKey = Script({OP_NOP});
    BOOST_CHECK(VerifyScript(scriptSig, scriptPubKey, SCRIPT_VERIFY_NONE, &err));
    BOOST_CHECK(!VerifyScript(scriptSig, scriptPubKey,
                              SCRIPT_VERIFY_P2SH | SCRIPT_VERIFY_CLEANSTACK, &err));
    BOOST_CHECK(err == ScriptError::CLEANSTACK);
}

BOOST_AUTO_TEST_SUITE_END()
