import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

describe('setup test', () => {
  it('renders without crashing', () => {
    const element = document.createElement('div')
    document.body.appendChild(element)
    expect(element).toBeTruthy()
  })

  it('can use React testing library', () => {
    const TestComponent = () => <div data-testid="test">Hello</div>
    render(<TestComponent />)
    expect(screen.getByTestId('test')).toBeTruthy()
    expect(screen.getByText('Hello')).toBeTruthy()
  })
})