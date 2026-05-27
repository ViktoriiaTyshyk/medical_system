/**
 * Тести для компонента Badge.
 *
 * Перевіряємо:
 * - рендеринг тексту
 * - правильний клас для кожного варіанту
 * - default варіант (gray)
 * - передачу додаткових props (className, onClick)
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Badge } from '@/components/ui/badge'

describe('Badge', () => {
  it('відображає текст', () => {
    render(<Badge>Завершено</Badge>)
    expect(screen.getByText('Завершено')).toBeInTheDocument()
  })

  it('рендериться як <span>', () => {
    const { container } = render(<Badge>Test</Badge>)
    expect(container.firstChild?.nodeName).toBe('SPAN')
  })

  it('default variant містить gray-клас', () => {
    const { container } = render(<Badge>Default</Badge>)
    const span = container.firstChild as HTMLElement
    // gray variant: bg-ink-subtle/20 text-ink-muted
    expect(span.className).toContain('text-ink-muted')
  })

  it('variant=green містить jade-клас', () => {
    const { container } = render(<Badge variant="green">Ок</Badge>)
    const span = container.firstChild as HTMLElement
    expect(span.className).toContain('text-jade')
  })

  it('variant=yellow містить amber-клас', () => {
    const { container } = render(<Badge variant="yellow">В роботі</Badge>)
    const span = container.firstChild as HTMLElement
    expect(span.className).toContain('text-amber')
  })

  it('variant=red містить rose-клас', () => {
    const { container } = render(<Badge variant="red">!</Badge>)
    const span = container.firstChild as HTMLElement
    expect(span.className).toContain('text-rose')
  })

  it('variant=blue містить sky-клас', () => {
    const { container } = render(<Badge variant="blue">Новий</Badge>)
    const span = container.firstChild as HTMLElement
    expect(span.className).toContain('text-sky')
  })

  it('додаткові className мерджаться коректно', () => {
    const { container } = render(<Badge className="custom-class">X</Badge>)
    const span = container.firstChild as HTMLElement
    expect(span.className).toContain('custom-class')
  })

  it('передає onClick і реагує на клік', async () => {
    const onClick = vi.fn()
    render(<Badge onClick={onClick}>Клікни</Badge>)
    await userEvent.click(screen.getByText('Клікни'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('рендерить JSX children', () => {
    render(
      <Badge>
        <span data-testid="inner">Inner</span>
      </Badge>
    )
    expect(screen.getByTestId('inner')).toBeInTheDocument()
  })
})
