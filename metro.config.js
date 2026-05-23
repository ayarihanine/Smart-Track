const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/private/defaults/exclusionList').default;

const config = getDefaultConfig(__dirname);

function escapePathForRegex(value) {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
}

const ignoredRoots = [
  path.resolve(__dirname, 'smartttrack'),
  path.resolve(__dirname, 'dist'),
];

config.resolver.blockList = exclusionList(
  ignoredRoots.map((root) => new RegExp(`${escapePathForRegex(root)}[/\\\\].*`))
);

module.exports = config;
