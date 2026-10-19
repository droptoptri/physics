import { expect, type Page } from '@playwright/test'

export async function checkResponsiveCopy(page: Page, entry: string) {
  const copy: [string, string][] = [
    ['.hero-copy>p', 'Сильные компании. Общие ресурсы. Единый подход к сложным строительным и инфраструктурным проектам.'],
    ['.section-heading h2', 'Одна команда. Масштаб вашей задачи.'],
    ['.partnership-inner h2', 'Следующий большой проект может стать нашим общим.'],
    ['.partnership-inner p', 'Присоединяйтесь к профессиональному объединению. Начнём со знакомства с вашей компанией.'],
    ['.geo-geography-heading h3', 'Опыт, который выходит за границы.'],
  ]
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [320, 360, 375, 390, 430, 760, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(entry)
    await page.evaluate(() => document.fonts.ready)
    for (const [selector, expected] of copy) {
      const text = await page.locator(selector).innerText()
      expect(text.replace(/\s+/g, ' ').trim(), `${width}px: ${selector}`).toBe(expected)
    }
    const defects = await page.locator('h1,h2,h3,p').evaluateAll(elements => elements.flatMap(element => {
      const text = (element as HTMLElement).innerText
      const rect = element.getBoundingClientRect()
      if (!rect.width || getComputedStyle(element).visibility === 'hidden') return []
      return /\n[ \t\u00a0]/.test(text) || rect.left < -1 || rect.right > innerWidth + 1 ? [text] : []
    }))
    expect(defects, `Indented lines or clipped copy at ${width}px`).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px`).toBeTruthy()
  }
}
