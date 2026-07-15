import { state } from '../state'
import { createDetailPanel } from './Detail'
import { createRollHistoryPanel } from './RollHistory'
import { createSidebar } from './Sidebar'

/** Check if we're on mobile viewport */
function isMobile(): boolean {
	return window.innerWidth <= 768
}

/** Close the sidebar on mobile */
export function closeMobileSidebar(): void {
	if (!isMobile()) return
	const sidebar = document.querySelector('.sidebar')
	const backdrop = document.querySelector('.sidebar-backdrop')
	sidebar?.classList.remove('open')
	backdrop?.classList.remove('visible')
}

export function createApp(container: HTMLElement): void {
	// Create mobile menu button
	const menuBtn = document.createElement('button')
	menuBtn.className = 'mobile-menu-btn'
	menuBtn.innerHTML = '☰'
	menuBtn.setAttribute('aria-label', 'Toggle menu')
	container.appendChild(menuBtn)

	// Create backdrop for mobile
	const backdrop = document.createElement('div')
	backdrop.className = 'sidebar-backdrop'
	container.appendChild(backdrop)

	// Create main components
	createSidebar(container)
	createDetailPanel(container)
	createRollHistoryPanel(container)

	// Get sidebar reference
	const sidebar = container.querySelector('.sidebar')

	// Toggle sidebar on menu button click
	menuBtn.addEventListener('click', () => {
		sidebar?.classList.toggle('open')
		backdrop.classList.toggle('visible')
	})

	// Close sidebar when clicking backdrop
	backdrop.addEventListener('click', () => {
		closeMobileSidebar()
	})

	// Close sidebar on mobile when item is selected
	state.subscribe((s) => {
		if (s.selectedItem && isMobile()) {
			closeMobileSidebar()
		}
	})

	// Handle escape key to close sidebar
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && isMobile()) {
			closeMobileSidebar()
		}
	})
}
