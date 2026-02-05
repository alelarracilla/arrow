import './App.css'
import { FollowSection } from './components/FollowSection/FollowSection'
import NavBar from './components/NavBar/NavBar'
import { NewsSection } from './components/NewsSection/NewsSection'
import { SearchBar } from './components/SearchBar/SearchBar'

function App(){ 

  return (
    <div >
      <SearchBar />
      <FollowSection />
      <NewsSection />
      <NavBar />
    </div>
  )
}

export default App
