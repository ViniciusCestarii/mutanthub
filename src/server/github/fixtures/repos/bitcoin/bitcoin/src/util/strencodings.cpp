// Copyright (c) 2026 The MutantHub fixture authors
// Distributed under the MIT software license.

#include <util/strencodings.h>

#include <algorithm>
#include <cstdint>
#include <cstring>
#include <limits>
#include <optional>
#include <string>
#include <vector>

static const std::string CHARS_ALPHA_NUM =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

static const std::string SAFE_CHARS[] = {
    CHARS_ALPHA_NUM + " .,;-_/:?@()", // SAFE_CHARS_DEFAULT
    CHARS_ALPHA_NUM + " .,;-_?@",     // SAFE_CHARS_UA_COMMENT
    CHARS_ALPHA_NUM + ".-_",          // SAFE_CHARS_FILENAME
    CHARS_ALPHA_NUM + "!*'();:@&=+$,/?#[]-_.~%", // SAFE_CHARS_URI
};

std::string SanitizeString(const std::string& str, int rule)
{
    std::string result;
    for (char c : str) {
        if (SAFE_CHARS[rule].find(c) != std::string::npos) {
            result.push_back(c);
        }
    }
    return result;
}

const signed char p_util_hexdigit[256] = {
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, -1, -1, -1, -1, -1, -1,
    -1, 0xa, 0xb, 0xc, 0xd, 0xe, 0xf, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, 0xa, 0xb, 0xc, 0xd, 0xe, 0xf, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
};

signed char HexDigit(char c)
{
    return p_util_hexdigit[static_cast<unsigned char>(c)];
}

bool IsHex(const std::string& str)
{
    for (char c : str) {
        if (HexDigit(c) < 0) return false;
    }
    return (str.size() > 0) && (str.size() % 2 == 0);
}

bool IsHexNumber(const std::string& str)
{
    size_t starting_location = 0;
    if (str.size() > 2 && str[0] == '0' && str[1] == 'x') {
        starting_location = 2;
    }
    for (const char c : str.substr(starting_location)) {
        if (HexDigit(c) < 0) return false;
    }
    // Return false for empty string or "0x".
    return str.size() > starting_location;
}

std::vector<unsigned char> ParseHex(const std::string& str)
{
    // convert hex dump to vector of bytes
    std::vector<unsigned char> vch;
    size_t i = 0;
    while (i < str.size()) {
        while (i < str.size() && IsSpace(str[i])) {
            i++;
        }
        if (i >= str.size()) break;
        signed char c = HexDigit(str[i++]);
        if (c == -1) break;
        unsigned char n = (c << 4);
        if (i >= str.size()) break;
        c = HexDigit(str[i++]);
        if (c == -1) break;
        n |= c;
        vch.push_back(n);
    }
    return vch;
}

static const int8_t decode64_table[256] = {
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 62, -1, -1, -1, 63,
    52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8,
    9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, -1, -1, -1, -1, -1, -1, 26,
    27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
    51, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
};

std::optional<std::vector<unsigned char>> DecodeBase64(const std::string& str)
{
    std::vector<unsigned char> ret;
    ret.reserve((str.size() * 3) / 4);

    int bits = 0;
    uint32_t acc = 0;
    size_t i = 0;
    while (i < str.size() && str[i] != '=') {
        const int8_t v = decode64_table[static_cast<unsigned char>(str[i])];
        if (v < 0) return std::nullopt;
        acc = (acc << 6) | static_cast<uint32_t>(v);
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            ret.push_back(static_cast<unsigned char>((acc >> bits) & 0xff));
        }
        i++;
    }
    // Trailing padding must be at most two '=' characters.
    size_t padding = 0;
    while (i < str.size() && str[i] == '=') {
        padding++;
        i++;
    }
    if (i != str.size() || padding > 2) return std::nullopt;
    if ((str.size() % 4) != 0) return std::nullopt;
    return ret;
}

std::string TrimString(const std::string& str, const std::string& pattern)
{
    const std::string::size_type front = str.find_first_not_of(pattern);
    if (front == std::string::npos) {
        return std::string();
    }
    const std::string::size_type end = str.find_last_not_of(pattern);
    return str.substr(front, end - front + 1);
}

bool ParseInt32(const std::string& str, int32_t* out)
{
    if (str.empty() || str.size() > 11) return false;
    size_t i = 0;
    bool negative = false;
    if (str[0] == '-') {
        negative = true;
        i = 1;
    }
    if (i >= str.size()) return false;
    int64_t value = 0;
    for (; i < str.size(); ++i) {
        if (str[i] < '0' || str[i] > '9') return false;
        value = value * 10 + (str[i] - '0');
        if (value > static_cast<int64_t>(std::numeric_limits<int32_t>::max()) + 1) return false;
    }
    if (negative) value = -value;
    if (value < std::numeric_limits<int32_t>::min() || value > std::numeric_limits<int32_t>::max()) {
        return false;
    }
    if (out) *out = static_cast<int32_t>(value);
    return true;
}
