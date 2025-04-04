"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

interface TypeWriterEffectProps {
  textArray: string[]
  typingSpeed?: number
  deletingSpeed?: number
  delayBeforeDeleting?: number
}

export function TypeWriterEffect({
  textArray,
  typingSpeed = 150,
  deletingSpeed = 100,
  delayBeforeDeleting = 2000,
}: TypeWriterEffectProps) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [state, setState] = useState({
    index: 0,
    isDeleting: false,
    text: "",
    isWaiting: false,
  })

  useEffect(() => {
    const { index, isDeleting, text, isWaiting } = state
    const fullText = textArray[index]
    let delay = isDeleting ? deletingSpeed : typingSpeed

    // When text is fully typed, wait before starting deletion
    if (!isDeleting && text === fullText) {
      if (!isWaiting) {
        setState((prev) => ({ ...prev, isWaiting: true })) // Set isWaiting to true when finished typing
      }
      delay = delayBeforeDeleting
      timeoutRef.current = setTimeout(() => {
        setState((prev) => ({ ...prev, isDeleting: true, isWaiting: false }))
      }, delay)
      return () => clearTimeout(timeoutRef.current!)
    }

    // When text is fully deleted, move to the next text
    if (isDeleting && text === "") {
      timeoutRef.current = setTimeout(() => {
        setState({
          index: (index + 1) % textArray.length,
          isDeleting: false,
          text: "",
          isWaiting: false, // Reset isWaiting when starting a new text
        })
      }, typingSpeed)
      return () => clearTimeout(timeoutRef.current!)
    }

    // Continue typing or deleting one character at a time
    timeoutRef.current = setTimeout(() => {
      setState((prev) => {
        const updatedText = isDeleting
          ? fullText.substring(0, prev.text.length - 1)
          : fullText.substring(0, prev.text.length + 1)
        return { ...prev, text: updatedText }
      })
    }, delay)

    return () => clearTimeout(timeoutRef.current!)
  }, [state, textArray, typingSpeed, deletingSpeed, delayBeforeDeleting])

  return (
    <>
      <span>{state.text}</span>
      <span
        className={cn("select-none", state.isWaiting && "animate-caret-blink")}
      >
        |
      </span>
    </>
  )
}
