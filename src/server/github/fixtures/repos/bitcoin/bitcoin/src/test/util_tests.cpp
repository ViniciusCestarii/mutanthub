// Copyright (c) 2026 The MutantHub fixture authors
// Distributed under the MIT software license.

#include <util/strencodings.h>
#include <test/util/setup_common.h>

#include <boost/test/unit_test.hpp>

BOOST_FIXTURE_TEST_SUITE(util_tests, BasicTestingSetup)

BOOST_AUTO_TEST_CASE(util_IsHex)
{
    BOOST_CHECK(IsHex("00"));
    BOOST_CHECK(IsHex("00112233445566778899aabbccddeeffAABBCCDDEEFF"));
    BOOST_CHECK(IsHex("ff"));
    BOOST_CHECK(IsHex("FF"));

    BOOST_CHECK(!IsHex(""));
    BOOST_CHECK(!IsHex("0"));
    BOOST_CHECK(!IsHex("a"));
    BOOST_CHECK(!IsHex("eleven"));
    BOOST_CHECK(!IsHex("00xx00"));
    BOOST_CHECK(!IsHex("0x0000"));
}

BOOST_AUTO_TEST_CASE(util_TrimString)
{
    BOOST_CHECK_EQUAL(TrimString(" foo bar ", " "), "foo bar");
    BOOST_CHECK_EQUAL(TrimString("\t\tfoo\n", "\t\n"), "foo");
    BOOST_CHECK_EQUAL(TrimString("   ", " "), "");
}

BOOST_AUTO_TEST_CASE(util_ParseInt32)
{
    int32_t n;
    BOOST_CHECK(ParseInt32("1234", &n) && n == 1234);
    BOOST_CHECK(ParseInt32("-1234", &n) && n == -1234);
    BOOST_CHECK(!ParseInt32("", &n));
    BOOST_CHECK(!ParseInt32("-", &n));
    BOOST_CHECK(!ParseInt32("2147483648", &n));
}

BOOST_AUTO_TEST_SUITE_END()
