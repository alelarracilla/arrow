import './App.css'
import { FollowSection } from './components/FollowSection/FollowSection'
import NavBar from './components/NavBar/NavBar'
import { SearchBar } from './components/SearchBar/SearchBar'

function App(){ 

  return (
    <div >
      <SearchBar />
      <FollowSection />
      <NavBar />
    </div>
  )
}

export default App
