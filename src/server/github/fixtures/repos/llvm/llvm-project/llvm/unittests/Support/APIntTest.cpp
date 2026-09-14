//===- llvm/unittest/Support/APIntTest.cpp - APInt unit tests -------------===//
//
// Part of the MutantHub fixture tree. Original simplified code.
// SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
//
//===----------------------------------------------------------------------===//

#include "llvm/ADT/APInt.h"
#include "gtest/gtest.h"

using namespace llvm;

namespace {

TEST(APIntTest, CountLeadingZerosSingleWord) {
  APInt Zero(32, 0);
  EXPECT_EQ(32u, Zero.countLeadingZeros());
  APInt One(32, 1);
  EXPECT_EQ(31u, One.countLeadingZeros());
  APInt Top(8, 0x80);
  EXPECT_EQ(0u, Top.countLeadingZeros());
}

TEST(APIntTest, PowerOfTwo) {
  EXPECT_TRUE(APInt(16, 1).isPowerOf2());
  EXPECT_TRUE(APInt(16, 1024).isPowerOf2());
  EXPECT_FALSE(APInt(16, 0).isPowerOf2());
  EXPECT_FALSE(APInt(16, 6).isPowerOf2());
  EXPECT_EQ(10, APInt(16, 1024).exactLogBase2());
  EXPECT_EQ(-1, APInt(16, 6).exactLogBase2());
}

TEST(APIntTest, UnsignedDivideMultiWord) {
  APInt Big(128, 0);
  Big = APInt(128, 1) << 100;
  EXPECT_EQ(0u, Big.urem(16));
  EXPECT_TRUE((Big.udiv(16) << 4) == Big);
  EXPECT_TRUE(APInt(128, 5).ult(Big));
}

} // namespace
