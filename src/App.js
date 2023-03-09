import React from 'react'
import icon from '../images/icon.gif'
import resume from '../files/Feb_2023.pdf'

const TopBar = () => {
  return (
    <div className="top-block" style={{paddingRight:'0px'}}>
      <div className="is-layout-flex centered" style={{ display: 'flex', padding: '2.25rem', paddingBottom: '0rem', marginLeft: '40px', marginRight: '55px'}}>
        <a href="index.html">
          <img decoding="async" src={icon} alt="me" width="90" height="90" />
        </a>
        <div style={{width:'140px', minWidth: '133.5px', paddingLeft: '10px', paddingRight: '20px', textAlign: 'center'}}>
          <h2 style={{fontSize: '22px'}}>josh<br/>cullen</h2>
        </div>
        <div>
        <p style={{ textAlign: 'right', textUnderlineOffset: '2px', paddingRight: '0px' }}>
          <a href="https://github.com/joshcull3n">github</a><br/>
          <a href="https://soundcloud.com/mrmoooon">soundcloud</a><br/>
          <a href="https://twitter.com/joshcull3n">twitter</a><br/>
          <a href="https://www.linkedin.com/in/jlcullen/">linkedin</a>
        </p>
        </div>
      </div>
      <Intro />
    </div>
  )
}

const Intro = () => {
  return (
    <div className="is-layout-flex centered" style={{marginTop:'0px'}}>
      <p style={{textAlign:'center', marginTop: '0px'}}>los angeles based software guy.<br/>currently head of QA at <a href="https://www.gridspace.com/">Gridspace</a>.</p>
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

const HorizontalGallery = () => {
  return (
    <div>
      <table className='navBar'>
        <tr>
          <GalleryItem imgUrl='https://www.rd.com/wp-content/uploads/2020/11/GettyImages-889552354-e1606774439626.jpg' link='/projects'/>
          <GalleryItem imgUrl='https://www.rd.com/wp-content/uploads/2020/11/GettyImages-889552354-e1606774439626.jpg' link='/photography'/>
          <GalleryItem imgUrl='https://www.rd.com/wp-content/uploads/2020/11/GettyImages-889552354-e1606774439626.jpg' link='/music'/>
        </tr>
      </table>
    </div>
  )
}

const GalleryItem = (props) => {
  return (
    <td style={{padding:'0px'}}>
      <div>
        <a href={props.link}><img className='navPic' alt='gallery item thumbnail' src={props.imgUrl}/></a>
      </div>
    </td>
  )
}

const App = () => {
  return (
    <div>
      <TopBar />
      <Footer />
    </div>
  )
}

export default App;
