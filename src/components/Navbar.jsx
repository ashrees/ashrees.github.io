import logo from "../assets/devlogo.png";
import { FaLinkedin } from "react-icons/fa";
import { FaGithub } from "react-icons/fa";
// import { FaInstagram } from "react-icons/fa";

const Navbar = () => {
  return (
    <nav className="mb-20 flex items-center justify-between py-5">
      <div className="flex flex-shrink-0 items-center">
        <a href="#" target="_blank" rel="noopener noreferrer">
          <img className="mx-2 w-10" src={logo} alt="logo" />
        </a>
      </div>
      <div className="m-7 flex items-center justify-center gap-4 text-2xl">
        <a
          href="https://www.linkedin.com/in/ashish-shrees-7aaa82261"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FaLinkedin />
        </a>
        <a
          href="https://github.com/ashrees"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FaGithub />
        </a>
        {/* <a
          href="https://www.instagram.com/a.shreesu/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FaInstagram />
        </a> */}
      </div>
    </nav>
  );
};

export default Navbar;
