import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useMotionValueEvent, animate } from "framer-motion";
import "../styles/simplify-animation.css";
import "../styles/global.css"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDollarSign, faCircleXmark, faCircle, faXmark, faCheck } from '@fortawesome/free-solid-svg-icons';

const SimplifyAnimation: React.FC = () => {
  const progress = useMotionValue(0);
  const pathRef = useRef<SVGPathElement | null>(null);
  const [iconPos, setIconPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const controls = animate(progress, 1, {
      delay: 0.2,
      duration: 1,
      ease: 'easeInOut',
      repeat: Infinity,
      repeatType: 'reverse',
    });
    return () => controls.stop();
  }, [progress]);

  useMotionValueEvent(progress, 'change', (latest) => {
    const path = pathRef.current;
    if (!path) return;

    const total = path.getTotalLength();
    const point = path.getPointAtLength(latest * total);
    setIconPos({ x: point.x, y: point.y });
  });

    const container = {
        visible: {
            transition: {
                delayChildren: 0.2,
                staggerChildren: 0.5
            }
        }
    }

    return (

        <motion.div variants={container} className="simplify-container">

            {/* Bad path */}
            <motion.div
                className="simplify-node position-top"
                initial={{ x: "-50%", y: "-50%" }}
                animate={{ scale: [0, 1, 1, 0], x: "-50%", y: "-50%" }}
                transition={{ duration: 7.5, times: [0, 0.066, 0.999, 1] }}
            >
                <p className='has-color-white'>T</p>
            </motion.div>
            <motion.div
                className="simplify-node position-left"
                initial={{ x: "-50%", y: "50%" }}
                animate={{ scale: [0, 1, 1, 0], x: "-50%", y: "50%" }}
                transition={{ duration: 7.5, times: [0, 0.132, 0.999, 1] }}
            >
                <p className='has-color-white'>K</p>
            </motion.div>
            <motion.div
                className="simplify-node position-right"
                initial={{ x: "50%", y: "50%" }}
                animate={{ scale: [0, 1, 1, 0], x: "50%", y: "50%" }}
                transition={{ duration: 7.5, times: [0, 0.199, 0.999, 1] }}
            >
                <p className='has-color-white'>S</p>
            </motion.div>
            <svg
                viewBox="0 0 100 56.25"
                preserveAspectRatio="xMidYMid meet"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            >
                <motion.path
                    d="m 50 10 l -25 35"
                    ref={pathRef}
                    fill="transparent"
                    stroke="var(--color-error)"
                    strokeWidth="2"
                    animate={{ pathLength: [0, 0, 1, 1, 1], opacity: [1, 1, 1, 1, 0] }}
                    transition={{ duration: 7.5, times: [0, 0.266, 0.388, 0.999, 1 ], ease: "easeInOut" }}
                />
            </svg>
            <motion.div
                className="dollar-node"
                style={{ position: 'absolute', transform: 'translate(-50%, -50%)' }}
                initial={{ left: '50%', top: '20%',}}
                animate={{
                    left: ['50%', '50%', '50%', '50%', '25%', '25%'],
                    top: ['20%', '20%', '20%', '20%', '80%', '80%'],
                    opacity: [0, 0, 1, 1, 1, 0],
                }}
                transition={{
                    duration: 7.5,
                    ease: 'easeInOut',
                    times: [0, 0.199, 0.233, 0.266, 0.388, 0.999],
                }}
            >
                <FontAwesomeIcon
                    icon={faDollarSign}
                    style={{ width: 16, height: 16, fontSize: 16, color: 'var(--color-error)' }}
                    aria-hidden="true"
                />
                </motion.div>

            <svg
                viewBox="0 0 100 56.25"
                preserveAspectRatio="xMidYMid meet"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            >
                <motion.path
                    d="m 50 10 l 25 35"
                    ref={pathRef}
                    fill="transparent"
                    stroke="var(--color-error)"
                    strokeWidth="2"
                    animate={{ pathLength: [0, 0, 1, 1, 1], opacity: [1, 1, 1, 1, 0] }}
                    transition={{ duration: 7.5, times: [0, 0.388, 0.520, 0.999, 1], ease: "easeInOut" }}
                />
            </svg>
            <motion.div
                className="dollar-node"
                style={{ position: 'absolute', transform: 'translate(-50%, -50%)' }}
                initial={{ left: '50%', top: '20%',}}
                animate={{
                    left: ['50%', '50%', '50%', '75%', '75%'],
                    top: ['20%', '20%', '20%', '80%', '80%'],
                    opacity: [0, 0, 1, 1, 0],
                }}
                transition={{
                    duration: 7.5,
                    ease: 'easeInOut',
                    times: [0, 0.199, 0.388, 0.520, 0.999],
                }}
            >
                <FontAwesomeIcon icon={faDollarSign} style={{ width: 16, height: 16, fontSize: 16, color: 'var(--color-error)' }} aria-hidden="true" />
            </motion.div>
            <svg
                viewBox="0 0 100 56.25"
                preserveAspectRatio="xMidYMid meet"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            >
                <motion.path
                    d="m 75 45 l -50 0"
                    fill="transparent"
                    stroke="var(--color-error)"
                    strokeWidth="2"
                    animate={{ pathLength: [0, 0, 1, 1, 1], opacity: [1, 1, 1, 1, 0] }}
                    transition={{ duration: 7.5, times: [0, 0.520, 0.652, 0.999, 1], ease: "easeInOut" }}
                />
            </svg>
            <motion.div
                className="dollar-node"
                style={{ position: 'absolute', bottom: '20%' }}
                initial={{ left: '75%', x: "-50%", y: "50%",}}
                animate={{
                    left: ['75%', '75%', '75%', '25%', '25%'],
                    opacity: [0, 0, 1, 1, 0],
                }}
                transition={{
                    duration: 7.5,
                    ease: 'easeInOut',
                    times: [0, 0.199, 0.520, 0.652, 0.999],
                }}
            >
                <FontAwesomeIcon icon={faDollarSign} style={{ width: 16, height: 16, fontSize: 16, color: 'var(--color-error)' }} aria-hidden="true" />
            </motion.div>
            <motion.div
                style={{ position: 'absolute', left: '50%', top: '50%', zIndex: 600 }}
                initial= {{ x: '-50%', y: '-50%', scale: 0 }}
                animate= {{ scale: [0, 0, 1, 50, 50, 50], opacity: [1, 1, 1, 1, 1, 0]}}
                transition={{ duration: 7.5, times: [0, 0.7, 0.766, 0.998, 0.999, 1] }}
            >
                 <span style={{ position: 'relative', display: 'inline-block' }}>
                    <FontAwesomeIcon icon={faCircle} style={{ fontSize: 32, color: 'var(--color-error)' }} aria-hidden="true" />
                    <FontAwesomeIcon icon={faXmark} style={{ fontSize: 24, color: 'var(--color-bg)', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', }} aria-hidden="true" />
                </span>
            </motion.div>

            {/* Good path */}
            <motion.div
                className="simplify-node position-top"
                initial={{ x: "-50%", y: "-50%" }}
                animate={{ scale: [0, 1, 1, 0], x: "-50%", y: "-50%" }}
                transition={{ delay: 7.5, duration: 7.5, times: [0, 0.066, 0.999, 1] }}
            >
                <p className='has-color-white'>T</p>
            </motion.div>
            <motion.div
                className="simplify-node position-left"
                initial={{ x: "-50%", y: "50%" }}
                animate={{ scale: [0, 1, 1, 0], x: "-50%", y: "50%" }}
                transition={{ delay: 7.5, duration: 7.5, times: [0, 0.132, 0.999, 1] }}
            >
                <p className='has-color-white'>K</p>
            </motion.div>
            <motion.div
                className="simplify-node position-right"
                initial={{ x: "50%", y: "50%" }}
                animate={{ scale: [0, 1, 1, 0], x: "50%", y: "50%" }}
                transition={{ delay: 7.5, duration: 7.5, times: [0, 0.199, 0.999, 1] }}
            >
                <p className='has-color-white'>S</p>
            </motion.div>
            <svg
                viewBox="0 0 100 56.25"
                preserveAspectRatio="xMidYMid meet"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            >
                <motion.path
                    d="m 50 10 l -25 35"
                    ref={pathRef}
                    fill="transparent"
                    stroke="var(--color-success)"
                    strokeWidth="2"
                    animate={{ pathLength: [0, 0, 1, 1, 1], opacity: [1, 1, 1, 1, 0] }}
                    transition={{ delay: 7.5,  duration: 7.5, times: [0, 0.266, 0.388, 0.999, 1 ], ease: "easeInOut" }}
                />
            </svg>
            <motion.div
                className="dollar-node"
                style={{ position: 'absolute', transform: 'translate(-50%, -50%)' }}
                initial={{ left: '50%', top: '20%',}}
                animate={{
                    left: ['50%', '50%', '50%', '50%', '25%', '25%'],
                    top: ['20%', '20%', '20%', '20%', '80%', '80%'],
                    opacity: [0, 0, 1, 1, 1, 0],
                }}
                transition={{
                    delay: 7.5, 
                    duration: 7.5,
                    ease: 'easeInOut',
                    times: [0, 0.199, 0.233, 0.266, 0.388, 0.999],
                }}
            >
                <FontAwesomeIcon
                    icon={faDollarSign}
                    style={{ width: 16, height: 16, fontSize: 16, color: 'var(--color-success)' }}
                    aria-hidden="true"
                />
                </motion.div>

            <svg
                viewBox="0 0 100 56.25"
                preserveAspectRatio="xMidYMid meet"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            >
                <motion.path
                    d="m 50 10 l 25 35"
                    ref={pathRef}
                    fill="transparent"
                    stroke="var(--color-success)"
                    strokeWidth="2"
                    animate={{ pathLength: [0, 0, 1, 1, 1], opacity: [1, 1, 1, 1, 0] }}
                    transition={{ delay: 7.5, duration: 7.5, times: [0, 0.388, 0.520, 0.999, 1], ease: "easeInOut" }}
                />
            </svg>
            <motion.div
                className="dollar-node"
                style={{ position: 'absolute', transform: 'translate(-50%, -50%)' }}
                initial={{ left: '50%', top: '20%',}}
                animate={{
                    left: ['50%', '50%', '50%', '75%', '75%'],
                    top: ['20%', '20%', '20%', '80%', '80%'],
                    opacity: [0, 0, 1, 1, 0],
                }}
                transition={{
                    delay: 7.5, 
                    duration: 7.5,
                    ease: 'easeInOut',
                    times: [0, 0.199, 0.388, 0.520, 0.999],
                }}
            >
                <FontAwesomeIcon icon={faDollarSign} style={{ width: 16, height: 16, fontSize: 16, color: 'var(--color-success)' }} aria-hidden="true" />
            </motion.div>
            <motion.div
                style={{ position: 'absolute', left: '50%', top: '50%', zIndex: 600 }}
                initial= {{ x: '-50%', y: '-50%', scale: 0 }}
                animate= {{ scale: [0, 0, 1, 50, 50, 50], opacity: [1, 1, 1, 1, 1, 0]}}
                transition={{ delay: 7.5, duration: 7.5, times: [0, 0.7, 0.766, 0.998, 0.999, 1] }}
            >
                 <span style={{ position: 'relative', display: 'inline-block' }}>
                    <FontAwesomeIcon icon={faCircle} style={{ fontSize: 32, color: 'var(--color-success)' }} aria-hidden="true" />
                    <FontAwesomeIcon icon={faCheck} style={{ fontSize: 24, color: 'var(--color-bg)', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', }} aria-hidden="true" />
                </span>
            </motion.div>

        </motion.div>
    )
}

export default SimplifyAnimation;