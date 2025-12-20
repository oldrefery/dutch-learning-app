// app.config.js
import appJson from './app.base.json'

export default () => ({
  ...appJson.expo,
  experiments: {
    ...(appJson.expo.experiments ?? {}),
    nativeTabs: true,
    typedRoutes: true,
  },
})
