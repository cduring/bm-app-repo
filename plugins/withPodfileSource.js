const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Injects the GitHub git specs source into the Podfile so CocoaPods doesn't
// try to reach cdn.cocoapods.org, which fails on Homebrew Ruby 4.0.1 + OpenSSL 3.6.1.
const withPodfileSource = (config) => {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf-8');
      const line = "source 'https://github.com/CocoaPods/Specs.git'\n\n";
      if (!contents.includes("source 'https://github.com/CocoaPods/Specs.git'")) {
        fs.writeFileSync(podfilePath, line + contents);
      }
      return config;
    },
  ]);
};

module.exports = withPodfileSource;
