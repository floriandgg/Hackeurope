import { useState, useEffect, useCallback } from 'react'
import LandingPage from './components/LandingPage'
import ArticleDiscoveryPage from './components/ArticleDiscoveryPage'
import StrategyPage from './components/StrategyPage'
import PrecedentsPage from './components/PrecedentsPage'
import DraftViewerPage from './components/DraftViewerPage'
import { searchCompany, type TopicGroup } from './api'

interface TopicInfo {
  name: string;
  summary: string;
}

export default function App() {
  const [view, setView] = useState<'landing' | 'discovery' | 'strategy' | 'precedents' | 'drafts'>('landing')
  const [companyName, setCompanyName] = useState('')
  const [selectedTopic, setSelectedTopic] = useState<TopicInfo | null>(null)
  const [selectedStrategy, setSelectedStrategy] = useState<number>(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [inputRect, setInputRect] = useState<DOMRect | null>(null)
  const [bubbleExpanded, setBubbleExpanded] = useState(false)

  // Agent 1 data
  const [topicGroups, setTopicGroups] = useState<TopicGroup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const handleSearch = useCallback((name: string, rect: DOMRect) => {
    setCompanyName(name)
    setInputRect(rect)
    setIsTransitioning(true)
    setTopicGroups([])
    setSearchError(null)
    setIsLoading(true)

    // Fire the API call alongside the bubble transition
    searchCompany(name)
      .then((groups) => {
        setTopicGroups(groups)
        setIsLoading(false)
      })
      .catch((err) => {
        console.error('Search failed:', err)
        setSearchError(err instanceof Error ? err.message : 'Search failed')
        setIsLoading(false)
      })
  }, [])

  useEffect(() => {
    if (isTransitioning && inputRect) {
      // Double rAF ensures the browser paints the initial position first
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setBubbleExpanded(true)
        })
      })

      const timer = setTimeout(() => {
        setView('discovery')
        setIsTransitioning(false)
        setBubbleExpanded(false)
        setInputRect(null)
      }, 900)

      return () => clearTimeout(timer)
    }
  }, [isTransitioning, inputRect])

  const handleBack = useCallback(() => {
    setView('landing')
    setCompanyName('')
    setSelectedTopic(null)
  }, [])

  const handleRespondToTopic = useCallback((topic: TopicInfo) => {
    setSelectedTopic(topic)
    setView('strategy')
  }, [])

  const handleBackToDiscovery = useCallback(() => {
    setView('discovery')
    setSelectedTopic(null)
  }, [])

  const handleViewDrafts = useCallback((strategyIndex: number) => {
    setSelectedStrategy(strategyIndex)
    setView('drafts')
  }, [])

  const handleSeeWhy = useCallback(() => {
    setView('precedents')
  }, [])

  const handleBackToStrategy = useCallback(() => {
    setView('strategy')
  }, [])

  return (
    <>
      {view === 'landing' && (
        <div
          style={{
            opacity: isTransitioning ? 0 : 1,
            transform: isTransitioning ? 'scale(0.98)' : 'scale(1)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}
        >
          <LandingPage onSubmit={handleSearch} />
        </div>
      )}

      {/* Bubble transition overlay */}
      {isTransitioning && inputRect && (
        <div
          className="fixed z-50 bg-white"
          style={{
            transition: 'all 0.85s cubic-bezier(0.65, 0, 0.35, 1)',
            top: bubbleExpanded ? 0 : inputRect.top,
            left: bubbleExpanded ? 0 : inputRect.left,
            width: bubbleExpanded ? '100vw' : inputRect.width,
            height: bubbleExpanded ? '100vh' : inputRect.height,
            borderRadius: bubbleExpanded ? 0 : 16,
            boxShadow: bubbleExpanded
              ? 'none'
              : '0 4px 30px rgba(43,58,143,0.08)',
          }}
        />
      )}

      {view === 'discovery' && (
        <ArticleDiscoveryPage
          companyName={companyName}
          topicGroups={topicGroups}
          isLoading={isLoading}
          searchError={searchError}
          onBack={handleBack}
          onRespondToTopic={handleRespondToTopic}
        />
      )}

      {view === 'strategy' && selectedTopic && (
        <StrategyPage
          companyName={companyName}
          topic={selectedTopic}
          onBack={handleBackToDiscovery}
          onViewDrafts={handleViewDrafts}
          onSeeWhy={handleSeeWhy}
        />
      )}

      {view === 'precedents' && selectedTopic && (
        <PrecedentsPage
          companyName={companyName}
          topic={selectedTopic}
          onBack={handleBackToStrategy}
        />
      )}

      {view === 'drafts' && selectedTopic && (
        <DraftViewerPage
          companyName={companyName}
          topic={selectedTopic}
          strategyIndex={selectedStrategy}
          onBack={handleBackToStrategy}
        />
      )}
    </>
  )
}
