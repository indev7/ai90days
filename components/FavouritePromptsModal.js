'use client';

import { useMemo, useState } from 'react';
import { FiPlay, FiX } from 'react-icons/fi';
import styles from './FavouritePromptsModal.module.css';

const sectionNameMap = new Map([
  ['my_favourites', 'My Favourites'],
  ['okrs', 'OKRs'],
  ['organisation', 'Organisation'],
  ['strategy', 'Strategy'],
  ['colleagues', 'Colleagues'],
  ['tasks', 'Tasks'],
  ['help', 'Help']
]);

const promptMap = new Map([
  ['fav-clarify', {
    sectionId: 'my_favourites',
    title: 'Clarify today’s focus',
    prompt: 'Help me pick the single most important outcome for today and why.'
  }],
  ['fav-draft', {
    sectionId: 'my_favourites',
    title: 'Draft a clean summary',
    prompt: 'Summarise my last 3 tasks into a concise update with outcomes.'
  }],
  ['fav-objective-progress', {
    sectionId: 'my_favourites',
    title: 'Tabulate my Objective progress',
    prompt: 'Tabulate my Objective progress'
  }],
  ['fav-shared-objectives-table', {
    sectionId: 'my_favourites',
    title: 'Tabulate shared Objective titles, owner name, and percentage completion, ordered by owner',
    prompt: 'Tabulate shared Objective titles, owner name, and percentage completion, ordered by owner'
  }],
  ['okr-spotlight', {
    sectionId: 'okrs',
    title: 'Spotlight stalled OKRs',
    prompt: 'Which OKRs look stalled and what is the smallest next move for each?'
  }],
  ['okr-clarity', {
    sectionId: 'okrs',
    title: 'Sharpen an Objective',
    prompt: 'Rewrite this objective to be more outcome-driven and measurable.'
  }],
  ['okr-generate', {
    sectionId: 'okrs',
    title: 'Help me generate OKRs',
    prompt: 'Help me generate OKRs'
  }],
  ['org-pulse', {
    sectionId: 'organisation',
    title: 'Organisation pulse',
    prompt: 'Give me a quick pulse check on team capacity, risks, and wins.'
  }],
  ['org-comms', {
    sectionId: 'organisation',
    title: 'Draft a leadership update',
    prompt: 'Draft a short leadership update: wins, blockers, next steps.'
  }],
  ['strat-risks', {
    sectionId: 'strategy',
    title: 'Strategy risk scan',
    prompt: 'Identify strategy risks and suggest one mitigation per risk.'
  }],
  ['strat-prioritise', {
    sectionId: 'strategy',
    title: 'Prioritise initiatives',
    prompt: 'Prioritise the initiatives by impact and effort with rationale.'
  }],
  ['colleagues-feedback', {
    sectionId: 'colleagues',
    title: 'Write thoughtful feedback',
    prompt: 'Draft constructive feedback for a colleague using SBI format.'
  }],
  ['colleagues-checkin', {
    sectionId: 'colleagues',
    title: 'Plan a check-in',
    prompt: 'Create an agenda for a 1:1 focused on growth and obstacles.'
  }],
  ['tasks-triage', {
    sectionId: 'tasks',
    title: 'Triage my task list',
    prompt: 'Triage my tasks into now/next/later and suggest first steps.'
  }],
  ['tasks-decompose', {
    sectionId: 'tasks',
    title: 'Decompose a task',
    prompt: 'Break this task into 5 concrete steps with time estimates.'
  }],
  ['help-org-chart', {
    sectionId: 'help',
    title: 'Where can I see the Org chart',
    prompt: 'Where can I see the Org chart'
  }],
  ['help-strategy-house', {
    sectionId: 'help',
    title: 'Where can I see the Strategy House view',
    prompt: 'Where can I see the Strategy House view'
  }],
  ['help-objectives-hierarchy', {
    sectionId: 'help',
    title: 'Where can I find Objectives hierarchy',
    prompt: 'Where can I find Objectives hierarchy'
  }]
]);

export default function FavouritePromptsModal({ isOpen, onClose, onPlay, isLoading }) {
  const sections = useMemo(
    () => Array.from(sectionNameMap.entries()).map(([id, name]) => ({ id, name })),
    []
  );
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? '');

  const promptsBySection = useMemo(() => {
    const grouped = new Map(sections.map((section) => [section.id, []]));
    promptMap.forEach((prompt) => {
      if (!grouped.has(prompt.sectionId)) {
        grouped.set(prompt.sectionId, []);
      }
      grouped.get(prompt.sectionId).push(prompt);
    });
    return grouped;
  }, [sections]);

  if (!isOpen) {
    return null;
  }

  const activePrompts = promptsBySection.get(activeSection) ?? [];
  const activeName = sectionNameMap.get(activeSection) ?? 'Prompts';

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(event) => event.stopPropagation()}>
        <header className={styles.modalHeader}>
          <div className={styles.heroIcon}>
            <span className={styles.heroIconImage} aria-hidden="true" />
          </div>
          <div className={styles.headerText}>
            <p className={styles.kicker}>AIME</p>
            <h2 className={styles.title}>Favourite Prompts</h2>
            <p className={styles.subtitle}>Tap a prompt to send it straight into AIME.</p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close Favourite Prompts"
          >
            <FiX size={20} />
          </button>
        </header>

        <div className={styles.body}>
          <aside className={styles.tabs}>
            <label className={styles.selectLabel} htmlFor="prompt-section-select">
              Section
            </label>
            <select
              id="prompt-section-select"
              className={styles.select}
              value={activeSection}
              onChange={(event) => setActiveSection(event.target.value)}
            >
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>

            <div className={styles.tabList}>
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={`${styles.tabButton} ${section.id === activeSection ? styles.tabActive : ''}`}
                  onClick={() => setActiveSection(section.id)}
                >
                  {section.name}
                </button>
              ))}
            </div>
          </aside>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h3>{activeName}</h3>
                <p>{activePrompts.length} prompts ready</p>
              </div>
            </div>

            <div className={styles.promptList}>
              {activePrompts.map((prompt) => (
                <div key={`${prompt.sectionId}-${prompt.title}`} className={styles.promptItem}>
                  <span className={styles.promptTitle}>{prompt.title}</span>
                  <button
                    type="button"
                    className={styles.playButton}
                    onClick={() => onPlay?.(prompt.prompt)}
                    disabled={isLoading}
                    aria-label={`Send prompt: ${prompt.title}`}
                    title="Send to AIME"
                  >
                    <FiPlay size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
