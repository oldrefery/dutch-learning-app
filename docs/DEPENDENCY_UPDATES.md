# Dependency Updates Plan

## Current State (October 4, 2025)

**Total Outdated Packages:** 19
**Security Vulnerabilities:** 0 ✅

## Update Categories

### 🟢 Safe Minor/Patch Updates (Low Risk)

These can be updated immediately without major concerns:

#### Development Dependencies

```bash
npm update @types/react@~19.1.17
npm update @typescript-eslint/eslint-plugin@^8.45.0
npm update @typescript-eslint/parser@^8.45.0
npm update eslint@^9.37.0
npm update typescript@~5.9.3
npm update dotenv@^17.2.3
```

#### Production Dependencies

```bash
npm update @supabase/supabase-js@^2.58.0
npm update expo@~54.0.12
npm update expo-dev-client@~6.0.13
npm update expo-router@~6.0.10
npm update expo-web-browser@~15.0.8
```

**Estimated Time:** 30 minutes
**Risk Level:** 🟢 Low
**Testing Required:** Smoke testing

---

### 🟡 Major Version Updates (Medium Risk)

Require testing and potentially code changes:

#### 1. **Jest 29 → 30**

```bash
npm install --save-dev jest@^30.2.0 jest-expo@~54.0.12
```

**Changes Required:**

- Update test configuration
- Check for API changes
- Run full test suite (once tests are implemented)

**Migration Guide:** https://jestjs.io/docs/upgrading-to-jest30

**Estimated Time:** 2-3 hours
**Priority:** Low (after test implementation)

---

#### 2. **lint-staged 15 → 16**

```bash
npm install --save-dev lint-staged@^16.2.3
```

**Changes Required:**

- Review configuration format changes
- Test pre-commit hooks

**Migration Guide:** https://github.com/lint-staged/lint-staged/releases/tag/v16.0.0

**Estimated Time:** 30 minutes
**Priority:** Low

---

#### 3. **react-native-worklets 0.5 → 0.6**

```bash
npm install react-native-worklets@^0.6.0
```

**Changes Required:**

- Review breaking changes in worklets API
- Test all Reanimated animations
- Verify gesture handlers

**Risk:** Moderate (affects animations)
**Estimated Time:** 2-3 hours
**Priority:** Medium

---

#### 4. **react-native-url-polyfill 2 → 3**

```bash
npm install react-native-url-polyfill@^3.0.0
```

**Changes Required:**

- Check for API changes
- Test Supabase integration
- Verify deep linking

**Estimated Time:** 1 hour
**Priority:** Low

---

## Update Strategy

### Phase 1: Immediate Updates (Now)

1. Update all safe minor/patch versions
2. Run `npm audit` to verify no new vulnerabilities
3. Test app on iOS/Android simulators
4. Commit changes

### Phase 2: Major Updates (After Tests)

1. Wait for test implementation (Phase 1 of Testing Plan)
2. Update Jest to v30
3. Run full test suite
4. Update lint-staged
5. Test pre-commit hooks

### Phase 3: Critical Updates (Post-Testing)

1. Update react-native-worklets
2. Extensive animation testing
3. Update react-native-url-polyfill
4. Test deep linking and Supabase

## Automation

### npm-check-updates

Install globally:

```bash
npm install -g npm-check-updates
```

Check updates:

```bash
ncu
```

Update minor/patch only:

```bash
ncu -u --target minor
```

### Dependabot (Recommended)

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    open-pull-requests-limit: 10
    versioning-strategy: increase-if-necessary
    ignore:
      - dependency-name: 'jest'
        versions: ['30.x']
      - dependency-name: 'lint-staged'
        versions: ['16.x']
```

## Testing Checklist

After each update, verify:

- [ ] App builds successfully
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No linting errors (`npm run lint`)
- [ ] App runs on iOS simulator
- [ ] App runs on Android simulator
- [ ] Authentication works
- [ ] Word addition works
- [ ] Review session works
- [ ] Animations are smooth
- [ ] Deep linking works

## Rollback Plan

If issues occur:

```bash
# Restore package.json
git restore package.json package-lock.json

# Reinstall dependencies
npm install

# Verify app works
npm start
```

## Update Schedule

**Monthly:** Check for minor/patch updates
**Quarterly:** Review major version updates
**Immediately:** Security vulnerabilities

## Notes

- Always update one major dependency at a time
- Test thoroughly before updating next dependency
- Document any breaking changes in CHANGELOG.md
- Consider LTS versions for critical dependencies

---

**Last Updated:** October 4, 2025
**Next Review:** November 2025
