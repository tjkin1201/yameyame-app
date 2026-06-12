// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // React Compiler 실험 룰 — "mount 시 1회 setLoading(true)" 패턴까지 에러로 잡는
      // 과잉탐지. cascading render 실위험은 코드리뷰에서 별도 검출하므로 warn 운용.
      // (render 중 impure 호출 같은 진짜 버그 클래스는 코드에서 직접 수정 — attendance nowTs 참조)
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
