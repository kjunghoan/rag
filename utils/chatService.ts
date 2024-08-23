export const updateMessages = (
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  newMessages: Message[]
) => {
  setMessages((prev: Message[]) => [...prev, ...newMessages]);
};

export const sendRequest = async (url: string, data: Message[]):
  Promise<ReadableStream<Uint8Array>> => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to send message");
  }

  if (!response.body) {
    throw new Error("Response body is missing");
  }

  return response.body;
};

export const processResponse = async (
  body: ReadableStream<Uint8Array>,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
) => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let result = "";

  const processText = async (
    { done, value }: ReadableStreamReadResult<Uint8Array>
  ): Promise<string> => {
    if (done) {
      return result;
    };

    const text = decoder.decode(value || new Uint8Array(), { stream: true });
    if (text.trim()) {
      setMessages((prev: Message[]) => {
        let lastMessage = prev[prev.length - 1];
        let otherMessages = prev.slice(0, prev.length - 1);
        return [
          ...otherMessages,
          {
            ...lastMessage,
            content: lastMessage.content + text
          }
        ];
      });
    };

    return reader.read().then(processText);
  };

  return reader.read().then(processText);
};

export const handleError = (
  error: any,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
) => {
  console.error(error);
  setMessages((prev: any) => [
    ...prev,
    {
      role: "assistant",
      content: "I'm sorry, I couldn't send your message. Please try again."
    }
  ]);
};
