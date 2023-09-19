import React from 'react'
import icon from '../images/icon.gif'
import resume from '../files/Sept_2023.pdf'
import todo_gif from '../images/todo.gif'
import todo_webm from '../images/todo.webm'
import habits_pic from '../images/habits.png'

const TopBar = () => {
  return (
    <div className="top-block" style={{paddingRight:'0px'}}>
      <div className="is-layout-flex centered" style={{ display: 'flex', padding: '2.25rem', paddingBottom: '0rem', marginLeft: '40px', marginRight: '55px'}}>
        <a href="index.html">
          <img decoding="async" src={icon} alt="me" width="100" height="100" />
        </a>
        <div style={{width:'140px', minWidth: '133.5px', paddingLeft: '10px', paddingRight: '20px', textAlign: 'center'}}>
          <h2 style={{fontSize: '22px'}}>josh cullen</h2>
        </div>
        <div>
        <p style={{ textAlign: 'right', textUnderlineOffset: '2px', paddingRight: '0px' }}>
          <a href="https://github.com/joshcull3n">github</a><br/>
          <a href="https://soundcloud.com/mrmoooon">soundcloud</a><br/>
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
    <div className="is-layout-flex centered" style={{marginTop:'0px', marginLeft:'5px'}}>
    <div style={{width: '405px',justifyContent: 'left', alignItems:'left'}}>
      <p style={{textAlign:'left', marginTop: '0px'}}>los angeles based web & automation dev.
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
        <a style={{backgroundColor:'rgba(0,0,0,0.3)', padding: '0 3px 3px 3px'}} href={resume}>peruse my resume</a>
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
              <td className='galleryTd'><GalleryItem imgUrl={habits_pic} link='/habits' title='habits' /></td>
              <td className='galleryTd'><GalleryItem imgUrl={todo_gif} link='https://github.com/joshcull3n/todo' title='todo'/></td>
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
              <td className='galleryTd'><GalleryItem imgUrl={habits_pic} link='/habits' title='habits' /></td>
              <td className='galleryTd'><GalleryVideo video={todo_webm} link='https://github.com/joshcull3n/todo' title='todo'/></td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }
}

const GalleryItem = (props) => {
  return (
    <div className='galleryDiv'>
      <a className='galleryItem' href={props.link}>
        <img alt='gallery item thumbnail' style={{maxHeight:'400px', maxWidth: '90vw'}} src={props.imgUrl}/>
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
        <video src={props.video} style={{maxHeight:'400px', maxWidth: '90vw'}} autoPlay={true} loop={true} muted={true} className='navPic' alt='gallery item thumbnail'/>
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
  return (
    <div>
      <TopBar />
      <HorizontalGallery title='projects' mobile={DetectDevice()}/>
      <Footer />
    </div>
  )
}

export default App;
