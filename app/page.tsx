'use client';
import { handleError, processResponse, sendRequest, updateMessages } from '@/utils/chatService';
import { Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const Home: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello, I'm the Rate My Professor support assistant. How can I help you today?",
    }
  ]);
  const [input, setInput] = useState("");
  const messageQueueRef = useRef<HTMLDivElement>(null);

  const sendMessage = async () => {
    updateMessages(setMessages, [
      { role: "user", content: input },
      { role: "assistant", content: "" }
    ]);
    setInput("");
    try {
      const body = await sendRequest(
        "/api/chat",
        [...messages, { role: 'user', content: input }]
      );
      await processResponse(body, setMessages);
    } catch (error) {
      handleError(error, setMessages);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    if (messageQueueRef.current) {
      messageQueueRef.current.scrollTop = messageQueueRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="w-screen h-screen p-5 flex flex-col justify-center items-center">
      <div
        id="chat"
        className="flex flex-col w-full max-w-[31.5rem] h-[44rem] max-h-full border-2 border-black p-2 space-y-3 rounded-lg mx-auto"
      >
        <div
          id="messageQueue"
          className="flex flex-col space-y-3 h-full overflow-y-auto"
        >
          {messages.map((message, index: number) => (
            <div
              key={index}
              id={`message-${index}`}
              className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`
                  ${message.role === "assistant" ? "bg-purple-700" : "bg-blue-400"}
                  text-white rounded-lg p-3 max-w-[70%]`
                }
              >
                {message.content}
              </div>
            </div>
          ))}
        </div>
        <div id="inputSection" className="m-2 relative">
          <label htmlFor="messageInput" className="block text-sm font-medium text-gray-700 mb-1">
            Message
          </label>
          <div className="flex">
            <textarea
              id="messageInput"
              className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none sm:text-sm resize-none"
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message here... (Shift+Enter for new line)"
            />
            <button
              onClick={sendMessage}
              className="px-4 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
