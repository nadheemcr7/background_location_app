// import {AppRegistry} from 'react-native';
// import App from './src/App';
// import {name as appName} from './app.json';
// import {LocationTask} from './src/LocationTask';

// AppRegistry.registerComponent(appName, () => App);

// // ✅ Register background Headless JS task
// AppRegistry.registerHeadlessTask('LocationTask', () => LocationTask);







import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);