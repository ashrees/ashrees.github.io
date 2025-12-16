import { CONTACT } from "../constants"
import { motion } from "framer-motion";

const Contact = () => {
  return (
    <div className="border-b border-neutral-900 pb-20">
        <motion.h1 
        whileInView={{opacity: 1, y: 0}}
        initial={{ y: -100, opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="my-10 text-center text-4xl">Get in Touch</motion.h1>
        <div className="text-center tracking-tighter">
            <motion.p 
            whileInView={{opacity: 1, x: 0}}
            initial={{ x: -100, opacity: 0 }}
            transition={{ duration: 1 }}
            className="my-4">{CONTACT.phoneNo}</motion.p>
            <a href="mailto:ashish.shrees9@gmail.com" className="border-b">{CONTACT.email}</a>
            <motion.div 
            whileInView={{opacity: 1, y: 0}}
            initial={{ y: 50, opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="pt-8 text-center text-neutral-500 text-1xl">
                <p>Created by Ashish Shrees</p>
            </motion.div>
        </div>
        </div>
  )
}

export default Contact