import { SignUp } from "@clerk/nextjs"
import { dark } from "@clerk/themes"

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Witaj w Panelu VTP</h1>
          <p className="text-muted-foreground">
            Zaloguj się, aby uzyskać dostęp do panelu
          </p>
        </div>
        <div className="flex justify-center">
          <SignUp 
            appearance={{
              baseTheme: dark,
              elements: {
                formButtonPrimary: "bg-primary hover:bg-primary/90",
                card: "shadow-lg",
                rootBox: "mx-auto",
                cardBox: "mx-auto",
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}
