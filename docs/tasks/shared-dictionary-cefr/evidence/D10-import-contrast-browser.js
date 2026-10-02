async page => {
  // Run with playwright-cli run-code after opening the visual-only fixture.
  const result = []
  for (const theme of ['light', 'dark']) {
    await page.evaluate(
      value => (document.documentElement.dataset.theme = value),
      theme
    )
    // Move off controls and disable transitions for stable resting-color samples.
    await page.mouse.move(0, 0)
    await page.addStyleTag({ content: '* { transition: none !important; }' })
    result.push(
      ...(await page.evaluate(theme => {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        const rgba = color => {
          ctx.clearRect(0, 0, 1, 1)
          ctx.fillStyle = color
          ctx.fillRect(0, 0, 1, 1)
          return [...ctx.getImageData(0, 0, 1, 1).data]
        }
        const blend = (front, back, opacity) =>
          front.map(
            (value, index) => value * opacity + back[index] * (1 - opacity)
          )
        const backgroundAt = element => {
          if (!element) return [255, 255, 255]
          const color = rgba(getComputedStyle(element).backgroundColor)
          return blend(
            color.slice(0, 3),
            backgroundAt(element.parentElement),
            color[3] / 255
          )
        }
        const luminance = color =>
          color
            .map(value => {
              const channel = value / 255
              return channel <= 0.04045
                ? channel / 12.92
                : ((channel + 0.055) / 1.055) ** 2.4
            })
            .reduce(
              (sum, value, index) =>
                sum + value * [0.2126, 0.7152, 0.0722][index],
              0
            )
        const ratio = (a, b) => {
          const values = [luminance(a), luminance(b)].sort((a, b) => b - a)
          return (values[0] + 0.05) / (values[1] + 0.05)
        }
        return [...document.querySelectorAll('section')].flatMap(section =>
          [...section.querySelectorAll('button,a')]
            .filter(element =>
              /^(Import|Start review|Open Visual|Publish collection|Stop sharing|Updating|Copy link)/.test(
                element.textContent.trim()
              )
            )
            .map(element => {
              const style = getComputedStyle(element)
              const foreground = rgba(style.color).slice(0, 3),
                background = backgroundAt(element)
              const parentBackground = backgroundAt(element.parentElement)
              const opacity = Number(style.opacity)
              const paintedContrast = ratio(
                blend(foreground, parentBackground, opacity),
                blend(background, parentBackground, opacity)
              )
              const disabled = element.disabled === true
              const contrast = ratio(foreground, background)
              const expectsDisabled =
                /duplicates|no-target|pending/.test(section.dataset.scenario) &&
                element.tagName === 'BUTTON' &&
                element.textContent.trim() !== 'Copy link'
              const disabledCorrect = disabled === expectsDisabled
              const rect = element.getBoundingClientRect()
              const visible =
                style.visibility === 'visible' &&
                style.display !== 'none' &&
                rect.width > 0 &&
                rect.height > 0
              return {
                theme,
                scenario: section.dataset.scenario,
                label: element.textContent.trim(),
                tag: element.tagName,
                disabled,
                color: style.color,
                background: style.backgroundColor,
                opacity: style.opacity,
                contrast: +contrast.toFixed(2),
                paintedContrast: +paintedContrast.toFixed(2),
                disabledCorrect,
                visible,
                pass:
                  visible &&
                  disabledCorrect &&
                  contrast >= 4.5 &&
                  paintedContrast >= (disabled ? 1.25 : 4.5),
              }
            })
        )
      }, theme))
    )
    await page.locator('[data-scenario="official-enabled"]').screenshot({
      path: `reports/shared-dictionary-cefr/d10-r4-repair-20261002/${theme}-enabled.png`,
    })
    await page.locator('[data-scenario="official-duplicates"]').screenshot({
      path: `reports/shared-dictionary-cefr/d10-r4-repair-20261002/${theme}-disabled.png`,
    })
    await page.screenshot({
      path: `reports/shared-dictionary-cefr/d10-r4-repair-20261002/${theme}-matrix.png`,
      fullPage: true,
    })
  }
  const missing = new Set(result.map(row => row.scenario)).size !== 16
  return {
    rows: result,
    allPassed: !missing && result.every(row => row.pass),
    scenarioCount: new Set(result.map(row => row.scenario)).size,
  }
}
