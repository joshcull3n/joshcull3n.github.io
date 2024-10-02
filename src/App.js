import React from 'react'
import icon from '../images/icon.gif'
import resume from '../files/Sept_2023.pdf'
import todo_gif from '../images/todo.gif'
import todo_webm from '../images/todo.webm'
import habits_pic from '../images/habits.png'
import './light.css'
import './dark.css'

const TopBar = () => {
  return (
    <div>
      <div className="is-layout-flex centered">
        <div className="is-layout-flex centered topBar" style={{ margin: '0.5rem 0px 0px 0px' }}>
          <a href="index.html">
            <img decoding="async" src={icon} alt="me" width="80" height="80" style={{ marginTop: '0.4rem', borderRadius: '3px' }} />
          </a>
          <div style={{width:'140px', minWidth: '133.5px', textAlign: 'center'}}>
            <h2 style={{fontSize: '22px'}}>josh cullen</h2>
          </div>
          <div>
          <p style={{ margin: 0, textAlign: 'right', textUnderlineOffset: '2px', paddingRight: '0px' }}>
            <a href="https://github.com/joshcull3n">github</a><br/>
            <a href="https://soundcloud.com/mrmoooon">soundcloud</a><br/>
            <a href="https://www.linkedin.com/in/jlcullen/">linkedin</a><br/>
            <a href={resume}>resume</a>
          </p>
          </div>
        </div>
      </div>
      <Intro />
    </div>
  )
}

const Intro = () => {
  return (
      <div className="is-layout-flex centered" style={{ }}>
        <div className="introBar" style={{ borderRadius: '3px', marginTop: '0.3%' }}>
          <p style={{marginTop: '0px', marginBottom: '1.5%', textAlign: 'center'}}>
            los angeles based web & automation dev.
            <br/>surfer, musician, & lover of creative software.
            <br/>currently head of QA at <a href="https://www.gridspace.com/">Gridspace</a>.
            </p>
        </div>
      </div>
  )
}

const Footer = () => {
  return (
    <footer className="footer" style={{ padding: '1rem 0 1rem', width: '100%', textAlign: 'center'}}>
      <div>
      </div>
    </footer>
  )
}

const HorizontalGallery = (props) => {
  console.log('mobile: ', props.mobile)
  if (props.mobile) {
    return (
      <div className="centered" style={{padding:'15px'}}>
        <table className='navBar'>
          <tbody>
            <tr>
              <td style={{paddingRight:'15px'}}><em><p style={{fontSize:'20px'}}>projects</p></em></td>
              <td className='galleryTd'><GalleryItem imgUrl={habits_pic} link='/habits' title='habits' imgId='habitsLink' mobile={true}/></td>
              <td className='galleryTd'><GalleryItem imgUrl={todo_gif} link='https://github.com/joshcull3n/todo' title='todo' imgId='todoLink' mobile={true}/></td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }
  else {
    return (
      <div className="centered" style={{padding:'15px'}}>
        <table className='navBar'>
          <tbody>
            <tr>
              <td className='galleryTd'><GalleryItem imgUrl={habits_pic} link='/habits' title='habits' imgId='habitsLink' mobile={false}/></td>
              <td className='galleryTd'><GalleryVideo video={todo_webm} link='https://github.com/joshcull3n/todo' title='todo' imgId='todoLink' mobile={false}/></td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }
}

const GalleryItem = (props) => {
  let maxHeight = '500px';
  if (props.mobile) {
    maxHeight = '80vw'
  }
  return (
    <div className='galleryDiv'>
      <a className='galleryItem' href={props.link}>
        <img alt='gallery item thumbnail' style={{ maxHeight: maxHeight, maxWidth: '90vw' }} id={props.imgId} src={props.imgUrl}/>
      </a>
      <div className='centered text-fade'>
        <a href={props.link} className='galleryText'>{props.title}</a>
      </div>
    </div>
  )
}

const GalleryVideo = (props) => {
  return (
    <div className='galleryDiv'>
      <a className='galleryItem' href={props.link}>
        <video src={props.video} style={{}} autoPlay={true} loop={true} muted={true} className='navPic' alt='gallery item thumbnail'/>
      </a>
      <div className='centered text-fade'>
        <a href={props.link} className='galleryText'>{props.title}</a>
      </div>
    </div>
  )
}

function DetectDevice() {
  var agnt = window.navigator.userAgent.toLowerCase()
  var isIpad = /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints && navigator.maxTouchPoints > 1;
  var mobile = false;

  if (agnt.includes('ipad') || agnt.includes('iphone') || agnt.includes('android') || agnt.includes('blackberry') || agnt.includes('webOS') || isIpad)
    mobile = true

  return mobile
}


const App = () => {
  // set body class
  document.body.classList.add("darkMode");

  return (
    <div>
      <TopBar />
      <HorizontalGallery title='projects' mobile={DetectDevice()}/>
      <Footer />
    </div>
  )
}

export default App;
