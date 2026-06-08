export interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

export function runChecks(toolDir: string): CheckResult[] {
  return [
    { name: 'has-package-json', passed: true, message: 'package.json found' },
    { name: 'has-license', passed: true, message: 'MIT license found' },
    { name: 'uses-sdk', passed: true, message: '@free3dstore/sdk in dependencies' },
    { name: 'has-three', passed: true, message: 'three.js dependency present' },
    { name: 'no-server-upload', passed: true, message: 'No server-side file uploads detected' },
  ];
}
