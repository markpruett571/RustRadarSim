import '@testing-library/jest-dom'
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { createCanvas } from 'canvas'

// Setup canvas for jsdom
if (typeof global.HTMLCanvasElement === 'undefined') {
  // @ts-ignore
  global.HTMLCanvasElement.prototype.getContext = function (contextType: string) {
    if (contextType === '2d') {
      const canvas = createCanvas(this.width, this.height)
      return canvas.getContext('2d')
    }
    return null
  }
}

// Cleanup after each test
afterEach(() => {
  cleanup()
})

