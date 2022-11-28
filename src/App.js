import React from 'react'
import icon from '../images/icon.png'
import resume from '../files/Nov_2022.pdf'

const TopBar = () => {
  return (
    <div className="top-block">
      <div className="is-layout-flex" style={{ flexWrap: 'nowrap', display: 'flex', padding: '2.25rem' }}>
        <a href="index.html">
          <img decoding='async' src={icon} alt="me" width="112" height="112" />
        </a>
        <div className="is-layout-flex">
          <h2>josh cullen</h2>
        </div>
        <p style={{ textAlign: 'right', textUnderlineOffset: '2px' }}>
          <a href="https://github.com/joshcull3n">github</a><br/>
          <a href="https://soundcloud.com/mrmoooon">soundcloud</a><br/>
          <a href="https://twitter.com/joshcull3n">twitter</a><br/>
          <a href="https://www.linkedin.com/in/jlcullen/">linkedin</a>
        </p>
      </div>
    </div>
  )
}

const Intro = () => {
  return (
    <div className="is-layout-flex" style={{ paddingLeft: '2.25rem', minWidth: '71px' }}>
      <p>hello there, this is my website. please enjoy yourself. your time on this earth is short.<br/><br/> &#8211; josh</p>
    </div>
  )
}

const Footer = () => {
  return (
    <footer className="footer" style={{ padding: '1rem 0 1rem', width: '100%', textAlign: 'center'}}>
      <div>
        <a href={resume}>peruse my resume</a>
      </div>
    </footer>
  )
}

const App = () => {
  return (
    <div>
      <TopBar />
      <Intro />
      <Footer />
    </div>
  )
}

export default App;