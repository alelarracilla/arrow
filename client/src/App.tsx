import './App.css'
import { FollowSection } from './components/FollowSection/FollowSection'
import NavBar from './components/NavBar/NavBar'
import { NewsSection } from './components/NewsSection/NewsSection'
import { OptionsSection } from './components/OptionsSection/OptionsSection'
import { SearchBar } from './components/SearchBar/SearchBar'
import { TradeProposals } from './components/TradeProposals/TradeProposals'

function App(){ 

  return (
    <div >
      <SearchBar />
      <OptionsSection />
      <FollowSection />
      <tv-ticker-tape symbols='FOREXCOM:SPXUSD,FOREXCOM:NSXUSD,FOREXCOM:DJI,FX:EURUSD,BITSTAMP:BTCUSD,BITSTAMP:ETHUSD,CMCMARKETS:GOLD'></tv-ticker-tape>
      <NewsSection />
      <TradeProposals />
      <NavBar />
    </div>
  )
}

export default App
