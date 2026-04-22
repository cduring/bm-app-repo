const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // @rnmapbox/maps 10.3.0 web entry imports mapbox-gl CSS which doesn't exist
  // in this project. Stub it out for all platforms.
  if (moduleName === 'mapbox-gl/dist/mapbox-gl.css') {
    return { type: 'empty' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
