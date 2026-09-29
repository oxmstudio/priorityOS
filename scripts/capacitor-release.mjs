import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const root = process.cwd();
const androidDir = resolve(root, 'android');
if (!existsSync(androidDir)) {
  throw new Error('The android/ project is missing. Run npx cap add android once, then rerun npm run cap:apk.');
}

const npmCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
execFileSync(npmCommand, ['cap', 'sync', 'android'], {cwd: root, stdio: 'inherit'});

const gradle = process.platform === 'win32'
  ? resolve(androidDir, 'gradlew.bat')
  : resolve(androidDir, 'gradlew');

if (!existsSync(gradle)) {
  throw new Error('Android Gradle wrapper is missing from android/. Open the Android project in Android Studio or regenerate it with npx cap add android.');
}

execFileSync(gradle, ['assembleDebug'], {cwd: androidDir, stdio: 'inherit'});

const apk = resolve(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
console.log(`\nPriorityOS APK: ${apk}`);
